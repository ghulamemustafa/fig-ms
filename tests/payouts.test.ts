import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  PayoutError,
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
  const testMembers = await prisma.member.findMany({
    where: { cnic: { startsWith: TEST_CNIC_PREFIX } },
    select: { id: true },
  });
  const ids = testMembers.map((m) => m.id);
  if (ids.length > 0) {
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

    const paid = await markPaid(payout.id, utcDate(2026, 9, 26));
    expect(paid.status).toBe("paid");
    expect(paid.paidDate).toEqual(utcDate(2026, 9, 26));
  });

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

    await expect(markPaid(payout.id, undefined)).rejects.toMatchObject({
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
