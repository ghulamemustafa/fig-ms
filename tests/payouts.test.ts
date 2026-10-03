import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  PayoutError,
  countPayouts,
  getPayoutsSummary,
  listPayouts,
  markPaid,
  presidentDecision,
  requestPayout,
  vpDecision,
} from "@/lib/payouts";

const TEST_CNIC_PREFIX = "88888-TEST";
const REF_NOW = new Date(Date.UTC(2026, 8, 26)); // 2026-09-26, matches the seed's reference "today"

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function makeTestMember(suffix: string, originalJoinDate: Date) {
  return prisma.member.create({
    data: {
      serialNo: `PAYOUT-TEST-${suffix}`,
      name: `Payout Test Member ${suffix}`,
      fatherName: "Test Father",
      cnic: `${TEST_CNIC_PREFIX}-${suffix}`,
      mobile: "0300-0000000",
      address: "Test address",
      maritalStatus: "single",
      occupation: "Tester",
      income: 10000,
      dob: utcDate(1990, 1, 1),
      originalJoinDate,
      currentJoinDate: originalJoinDate,
      status: "active",
    },
  });
}

async function cleanup() {
  await prisma.setting.deleteMany({ where: { key: "requirePayoutApproval" } });
  const testMembers = await prisma.member.findMany({
    where: { cnic: { startsWith: TEST_CNIC_PREFIX } },
    select: { id: true },
  });
  const ids = testMembers.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.fundPayout.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.member.deleteMany({ where: { id: { in: ids } } });
  }
}

let treasurer: { id: string };
let vp: { id: string };
let president: { id: string };

beforeAll(async () => {
  await cleanup();
  treasurer = await prisma.user.findFirstOrThrow({ where: { role: "treasurer" } });
  vp = await prisma.user.findFirstOrThrow({ where: { role: "vp" } });
  president = await prisma.user.findFirstOrThrow({ where: { role: "president" } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("requestPayout", () => {
  it("blocks an ineligible member with a clear reason", async () => {
    // Joined 1 month ago — well short of the >3-month eligibility rule.
    const member = await makeTestMember("ineligible", utcDate(2026, 8, 26));

    await expect(
      requestPayout(
        { memberId: member.id, payoutType: "other", amount: 5000 },
        treasurer.id,
        REF_NOW
      )
    ).rejects.toMatchObject({
      code: "NOT_ELIGIBLE",
      detail: { eligible: false, eligibilityMonths: 3 },
    });
  });

  it("succeeds for an eligible member, with no cap on amount", async () => {
    const member = await makeTestMember("eligible", utcDate(2020, 1, 1));

    const payout = await requestPayout(
      { memberId: member.id, payoutType: "funeral", amount: 250000 },
      treasurer.id
    );

    expect(payout.status).toBe("requested");
    expect(Number(payout.amount)).toBe(250000);
    expect(payout.requestedById).toBe(treasurer.id);
  });
});

describe("VP rejection is terminal", () => {
  it("a VP-rejected payout can never reach or be acted on by the President", async () => {
    const member = await makeTestMember("vp-rejected", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "other", amount: 1000 },
      treasurer.id
    );

    const rejected = await vpDecision(payout.id, "reject", "Insufficient documentation", vp.id);
    expect(rejected.status).toBe("vp_rejected");
    expect(rejected.vpRejectReason).toBe("Insufficient documentation");

    // The president's queue is literally `listPayouts({ status: "vp_approved" })`,
    // so a vp_rejected payout is structurally absent from it — and even a direct
    // attempt to act on it by id is refused:
    await expect(
      presidentDecision(payout.id, "approve", undefined, president.id)
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("full approve-through-paid flow", () => {
  it("requested -> vp_approved -> president_approved -> paid", async () => {
    const member = await makeTestMember("full-flow", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "widow", amount: 15000 },
      treasurer.id
    );
    expect(payout.status).toBe("requested");

    const vpApproved = await vpDecision(payout.id, "approve", undefined, vp.id);
    expect(vpApproved.status).toBe("vp_approved");
    expect(vpApproved.vpDecisionById).toBe(vp.id);

    const presApproved = await presidentDecision(payout.id, "approve", undefined, president.id);
    expect(presApproved.status).toBe("president_approved");
    expect(presApproved.presDecisionById).toBe(president.id);

    const paid = await markPaid(payout.id, utcDate(2026, 9, 26), treasurer.id);
    expect(paid.status).toBe("paid");
    expect(paid.paidDate).toEqual(utcDate(2026, 9, 26));
  }, 30_000);

  it("refuses a President decision before VP approval", async () => {
    const member = await makeTestMember("no-vp-yet", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "other", amount: 1000 },
      treasurer.id
    );

    await expect(
      presidentDecision(payout.id, "approve", undefined, president.id)
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("refuses to mark paid before President approval", async () => {
    const member = await makeTestMember("no-pres-yet", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "other", amount: 1000 },
      treasurer.id
    );
    await vpDecision(payout.id, "approve", undefined, vp.id);

    await expect(markPaid(payout.id, undefined, treasurer.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });
});

// Role restrictions at the HTTP layer (requireRole in each route handler,
// e.g. a vp session cannot POST /api/payouts/[id]/president-decision) are
// covered by live API testing in the walkthrough rather than here — that
// check lives in the route handler, not these lib functions, and exercising
// it faithfully needs a real authenticated session/cookie.
describe("PayoutError", () => {
  it("is thrown as a real Error subclass with a stable code", async () => {
    await expect(
      vpDecision("does-not-exist", "approve", undefined, vp.id)
    ).rejects.toBeInstanceOf(PayoutError);
  });
});

describe("payout approval setting", () => {
  const KEY = "requirePayoutApproval";
  let overrideId: string | null = null;

  async function setApprovalRequired(value: "true" | "false") {
    // A row effective before REF_NOW so it wins over the seeded baseline as of REF_NOW.
    const row = await prisma.setting.create({
      data: { key: KEY, value, effectiveFrom: utcDate(2026, 9, 1) },
    });
    overrideId = row.id;
  }

  afterAll(async () => {
    if (overrideId) await prisma.setting.deleteMany({ where: { id: overrideId } });
  });

  it("with approval required (the default), a new request waits for the VP", async () => {
    const member = await makeTestMember("appr-on", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "other", amount: 1000 },
      treasurer.id,
      REF_NOW
    );
    expect(payout.status).toBe("requested");
    expect(payout.autoApproved).toBe(false);
  });

  it("with approval not required, a request is paid immediately with paidDate set to request date", async () => {
    await setApprovalRequired("false");
    const member = await makeTestMember("appr-off", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "other", amount: 1000 },
      treasurer.id,
      REF_NOW
    );
    expect(payout.status).toBe("paid");
    expect(payout.autoApproved).toBe(true);
    expect(payout.paidDate).toEqual(REF_NOW);
    expect(payout.vpDecisionById).toBeNull();
    expect(payout.presDecisionById).toBeNull();

    // No approver acts on it, and it cannot be paid again.
    await expect(vpDecision(payout.id, "approve", undefined, vp.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(markPaid(payout.id, REF_NOW, treasurer.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("does not change payouts that were already waiting for approval", async () => {
    // Requested while approval was still required, then the setting is switched off.
    await prisma.setting.deleteMany({ where: { id: overrideId! } });
    overrideId = null;
    const member = await makeTestMember("appr-inflight", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "other", amount: 1000 },
      treasurer.id,
      REF_NOW
    );
    await setApprovalRequired("false");
    const stillWaiting = await prisma.fundPayout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(stillWaiting.status).toBe("requested");
    const approved = await vpDecision(payout.id, "approve", undefined, vp.id);
    expect(approved.status).toBe("vp_approved");
    void president;
  });
});

describe("payouts listing, filtering, and summary", () => {
  it(
    "filters by status and member",
    async () => {
      const memberA = await makeTestMember("list-a", utcDate(2020, 1, 1));
      const memberB = await makeTestMember("list-b", utcDate(2020, 1, 1));

      const pA = await requestPayout(
        { memberId: memberA.id, payoutType: "funeral", amount: 15000, reason: "Special funeral aid" },
        treasurer.id,
        REF_NOW
      );
      const pB = await requestPayout(
        { memberId: memberB.id, payoutType: "widow", amount: 25000, reason: "Monthly widow support" },
        treasurer.id,
        REF_NOW
      );

      const vpApp = await vpDecision(pA.id, "approve", undefined, vp.id);
      await presidentDecision(vpApp.id, "approve", undefined, president.id);
      await markPaid(pA.id, REF_NOW, treasurer.id);

      // List by status "paid"
      const paidList = await listPayouts({ status: "paid", memberId: memberA.id });
      expect(paidList.some((p) => p.id === pA.id)).toBe(true);
      expect(paidList.some((p) => p.id === pB.id)).toBe(false);

      // List by memberId
      const bList = await listPayouts({ memberId: memberB.id });
      expect(bList.length).toBe(1);
      expect(bList[0].id).toBe(pB.id);
    },
    15000
  );

  it("filters by payoutType", async () => {
    const member = await makeTestMember("type-filter", utcDate(2020, 1, 1));
    const pFuneral = await requestPayout(
      { memberId: member.id, payoutType: "funeral", amount: 10000 },
      treasurer.id,
      REF_NOW
    );
    const pWidow = await requestPayout(
      { memberId: member.id, payoutType: "widow", amount: 20000 },
      treasurer.id,
      REF_NOW
    );

    const funerals = await listPayouts({ memberId: member.id, payoutType: "funeral" });
    expect(funerals.length).toBe(1);
    expect(funerals[0].id).toBe(pFuneral.id);

    const widows = await listPayouts({ memberId: member.id, payoutType: "widow" });
    expect(widows.length).toBe(1);
    expect(widows[0].id).toBe(pWidow.id);
  });

  it("searches across member name and reason", async () => {
    const member = await makeTestMember("search-needle", utcDate(2020, 1, 1));
    const payout = await requestPayout(
      { memberId: member.id, payoutType: "other", amount: 5000, reason: "Emergency medical expense assistance" },
      treasurer.id,
      REF_NOW
    );

    // Search by member unique suffix
    const searchByMember = await listPayouts({ search: "search-needle" });
    expect(searchByMember.some((p) => p.id === payout.id)).toBe(true);

    // Search by unique reason word
    const searchByReason = await listPayouts({ search: "medical expense" });
    expect(searchByReason.some((p) => p.id === payout.id)).toBe(true);

    // Search for non-existent text
    const searchNone = await listPayouts({ search: "non-existent-xyz-999" });
    expect(searchNone.length).toBe(0);
  });

  it(
    "paginates payouts with page and pageSize",
    async () => {
      const member = await makeTestMember("page-test", utcDate(2020, 1, 1));
      for (let i = 1; i <= 5; i++) {
        await requestPayout(
          { memberId: member.id, payoutType: "other", amount: i * 1000 },
          treasurer.id,
          REF_NOW
        );
      }

      const total = await countPayouts({ memberId: member.id });
      expect(total).toBe(5);

      const page1 = await listPayouts({ memberId: member.id, page: 1, pageSize: 2 });
      expect(page1.length).toBe(2);

      const page2 = await listPayouts({ memberId: member.id, page: 2, pageSize: 2 });
      expect(page2.length).toBe(2);

      const page3 = await listPayouts({ memberId: member.id, page: 3, pageSize: 2 });
      expect(page3.length).toBe(1);

      // Ensure page1 and page2 do not overlap
      const page1Ids = page1.map((p) => p.id);
      const page2Ids = page2.map((p) => p.id);
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    },
    15000
  );

  it(
    "calculates accurate summary totals across statuses",
    async () => {
      const member = await makeTestMember("summary-test", utcDate(2020, 1, 1));

      // 1 requested
      await requestPayout(
        { memberId: member.id, payoutType: "other", amount: 1000 },
        treasurer.id,
        REF_NOW
      );

      // 1 paid
      const pPaid = await requestPayout(
        { memberId: member.id, payoutType: "other", amount: 3000 },
        treasurer.id,
        REF_NOW
      );
      const vp1 = await vpDecision(pPaid.id, "approve", undefined, vp.id);
      await presidentDecision(vp1.id, "approve", undefined, president.id);
      await markPaid(pPaid.id, REF_NOW, treasurer.id);

      // 1 rejected
      const pRej = await requestPayout(
        { memberId: member.id, payoutType: "other", amount: 2000 },
        treasurer.id,
        REF_NOW
      );
      await vpDecision(pRej.id, "reject", "Not justified", vp.id);

      const summary = await getPayoutsSummary({ memberId: member.id });
      expect(summary.totalCount).toBe(3);
      expect(summary.totalAmount).toBe(6000);
      expect(summary.paidCount).toBe(1);
      expect(summary.paidAmount).toBe(3000);
      expect(summary.pendingCount).toBe(1);
      expect(summary.pendingAmount).toBe(1000);
      expect(summary.rejectedCount).toBe(1);
      expect(summary.rejectedAmount).toBe(2000);
    },
    15000
  );
});
