import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  getOutstandingMonths,
  getUpcomingMonths,
  recordPayments,
  PaymentError,
  countDefaulters,
  listDefaulters,
} from "@/lib/payments";

/**
 * These create their own throwaway Member fixtures (unlike tests/rules.test.ts,
 * which reads the frozen seed data) because this suite needs to mutate state
 * (record payments, reactivate a removed member) without disturbing the
 * shared dev seed or depending on its current mutable state.
 */
const REF_NOW = new Date(Date.UTC(2026, 8, 26)); // 2026-09-26, matches the seed's reference "today"
const TEST_CNIC_PREFIX = "99999-TEST";

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function makeTestMember(overrides: {
  suffix: string;
  originalJoinDate: Date;
  currentJoinDate: Date;
  status?: string;
  removedDate?: Date | null;
}) {
  return prisma.member.create({
    data: {
      serialNo: `TEST-${overrides.suffix}`,
      name: `Test Member ${overrides.suffix}`,
      fatherName: "Test Father",
      cnic: `${TEST_CNIC_PREFIX}-${overrides.suffix}`,
      mobile: "0300-0000000",
      address: "Test address",
      maritalStatus: "single",
      occupation: "Tester",
      income: 10000,
      dob: utcDate(1990, 1, 1),
      originalJoinDate: overrides.originalJoinDate,
      currentJoinDate: overrides.currentJoinDate,
      status: overrides.status ?? "active",
      removedDate: overrides.removedDate ?? null,
    },
  });
}

async function cleanupTestMembers() {
  const testMembers = await prisma.member.findMany({
    where: { cnic: { startsWith: TEST_CNIC_PREFIX } },
    select: { id: true },
  });
  const ids = testMembers.map((m) => m.id);
  if (ids.length === 0) return;
  await prisma.auditLog.deleteMany({ where: { memberId: { in: ids } } });
  await prisma.payment.deleteMany({ where: { memberId: { in: ids } } });
  await prisma.member.deleteMany({ where: { id: { in: ids } } });
}

let recorder: { id: string };

beforeAll(async () => {
  await cleanupTestMembers(); // in case a previous failed run left fixtures behind
  recorder = await prisma.user.findFirstOrThrow({ where: { role: "treasurer" } });
});

afterAll(async () => {
  await cleanupTestMembers();
  await prisma.$disconnect();
});

describe("getOutstandingMonths", () => {
  it("charges 2x for a new member's first months, none paid yet", async () => {
    const member = await makeTestMember({
      suffix: "new1",
      originalJoinDate: utcDate(2026, 8, 5),
      currentJoinDate: utcDate(2026, 8, 5),
    });

    const outstanding = await getOutstandingMonths(member, [], REF_NOW);

    expect(outstanding).toHaveLength(2); // Aug, Sep 2026
    for (const month of outstanding) {
      expect(month.amount).toBe(1000);
      expect(month.wasDoubleFee).toBe(true);
    }
  });

  it("drops to the normal rate from month 4 onward, once earlier months are paid", async () => {
    const member = await makeTestMember({
      suffix: "new2",
      originalJoinDate: utcDate(2026, 5, 5),
      currentJoinDate: utcDate(2026, 5, 5),
    });
    // Months 0-2 (May, Jun, Jul) already paid at 2x; Aug/Sep (months 3, 4) remain.
    const existingPayments = [
      { monthCovered: utcDate(2026, 5, 1) },
      { monthCovered: utcDate(2026, 6, 1) },
      { monthCovered: utcDate(2026, 7, 1) },
    ];

    const outstanding = await getOutstandingMonths(member, existingPayments, REF_NOW);

    expect(outstanding.map((o) => o.monthCovered.getUTCMonth())).toEqual([7, 8]); // Aug, Sep (0-indexed)
    for (const month of outstanding) {
      expect(month.amount).toBe(500);
      expect(month.wasDoubleFee).toBe(false);
    }
  });

  it("caps a removed member's arrears at their removedDate and charges the normal rate (no 2x), plus a fresh resume month", async () => {
    const member = await makeTestMember({
      suffix: "removed1",
      originalJoinDate: utcDate(2020, 1, 1), // old — currentJoinDate differs, so no 2x regardless
      currentJoinDate: utcDate(2026, 4, 1), // e.g. reset by an earlier rejoin
      status: "removed",
      removedDate: utcDate(2026, 6, 15),
    });

    const outstanding = await getOutstandingMonths(member, [], REF_NOW);

    // Arrears Apr, May, Jun 2026 (capped at removedDate's month) + Sep 2026 (today's month, resume charge).
    const months = outstanding.map((o) => o.monthCovered.getUTCMonth());
    expect(months).toEqual([3, 4, 5, 8]);
    for (const month of outstanding) {
      expect(month.amount).toBe(500);
      expect(month.wasDoubleFee).toBe(false);
    }
  });
});

describe("recordPayments", () => {
  it("records multiple months in one call under a single shared receipt", async () => {
    const member = await makeTestMember({
      suffix: "multi1",
      originalJoinDate: utcDate(2026, 5, 5),
      currentJoinDate: utcDate(2026, 5, 5),
    });
    const months = [utcDate(2026, 8, 1), utcDate(2026, 9, 1)];

    const result = await recordPayments({
      memberId: member.id,
      months,
      recordedById: recorder.id,
    });

    expect(result.payments).toHaveLength(2);
    expect(new Set(result.payments.map((p) => p.receiptNo)).size).toBe(1);
    for (const payment of result.payments) {
      expect(Number(payment.amount)).toBe(500);
      expect(payment.wasDoubleFee).toBe(false);
    }
  });

  it("refuses to record a payment for a removed member without confirmReactivation", async () => {
    const member = await makeTestMember({
      suffix: "removed2",
      originalJoinDate: utcDate(2020, 1, 1),
      currentJoinDate: utcDate(2026, 4, 1),
      status: "removed",
      removedDate: utcDate(2026, 6, 15),
    });

    await expect(
      recordPayments({
        memberId: member.id,
        months: [utcDate(2026, 4, 1)],
        recordedById: recorder.id,
      })
    ).rejects.toThrow(PaymentError);
  });

  it("reactivates a removed member and charges arrears at the normal rate when confirmed", async () => {
    const member = await makeTestMember({
      suffix: "removed3",
      originalJoinDate: utcDate(2020, 1, 1),
      currentJoinDate: utcDate(2026, 4, 1),
      status: "removed",
      removedDate: utcDate(2026, 6, 15),
    });

    const result = await recordPayments({
      memberId: member.id,
      months: [utcDate(2026, 4, 1), utcDate(2026, 5, 1), utcDate(2026, 6, 1)],
      recordedById: recorder.id,
      confirmReactivation: true,
    });

    expect(result.member.status).toBe("active");
    expect(result.member.removedDate).toBeNull();
    expect(result.payments).toHaveLength(3);
    for (const payment of result.payments) {
      expect(payment.wasDoubleFee).toBe(false);
      expect(Number(payment.amount)).toBe(500);
    }
  });

  it("refuses to double-pay an already-paid month", async () => {
    const member = await makeTestMember({
      suffix: "dup1",
      originalJoinDate: utcDate(2026, 5, 5),
      currentJoinDate: utcDate(2026, 5, 5),
    });
    await recordPayments({
      memberId: member.id,
      months: [utcDate(2026, 8, 1)],
      recordedById: recorder.id,
    });

    await expect(
      recordPayments({
        memberId: member.id,
        months: [utcDate(2026, 8, 1)],
        recordedById: recorder.id,
      })
    ).rejects.toThrow(PaymentError);
  });
});

describe("advance payments", () => {
  it("lists the next 12 unpaid months and skips ones already paid ahead", async () => {
    const member = await makeTestMember({
      suffix: "adv1",
      originalJoinDate: utcDate(2020, 1, 1),
      currentJoinDate: utcDate(2020, 1, 1),
    });
    const upcoming = await getUpcomingMonths(member, [{ monthCovered: utcDate(2026, 10, 1) }], REF_NOW);
    expect(upcoming).toHaveLength(11);
    expect(upcoming[0].monthCovered.toISOString().slice(0, 7)).toBe("2026-11");
    expect(upcoming.at(-1)!.monthCovered.toISOString().slice(0, 7)).toBe("2027-09");
  });

  it("records months ahead under one receipt, and they do not hide earlier unpaid months", async () => {
    const member = await makeTestMember({
      suffix: "adv2",
      originalJoinDate: utcDate(2025, 1, 1),
      currentJoinDate: utcDate(2025, 1, 1),
    });
    const now = new Date();
    const month = (offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    // Pay 3 months ahead, but not this month or earlier.
    const { payments } = await recordPayments({
      memberId: member.id,
      months: [month(1), month(2), month(3)],
      recordedById: recorder.id,
    });
    expect(new Set(payments.map((p) => p.receiptNo)).size).toBe(1);

    const all = await prisma.payment.findMany({ where: { memberId: member.id } });
    const outstanding = await getOutstandingMonths(member, all);
    // This month is still owed even though later months are paid.
    expect(outstanding.some((o) => o.monthCovered.getTime() === month(0).getTime())).toBe(true);
    expect(outstanding.every((o) => o.monthCovered.getTime() <= month(0).getTime())).toBe(true);
  });

  it("rejects payments more than 12 months ahead", async () => {
    const member = await makeTestMember({
      suffix: "adv3",
      originalJoinDate: utcDate(2025, 1, 1),
      currentJoinDate: utcDate(2025, 1, 1),
    });
    const now = new Date();
    const tooFar = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 13, 1));
    await expect(
      recordPayments({ memberId: member.id, months: [tooFar], recordedById: recorder.id })
    ).rejects.toMatchObject({ code: "TOO_FAR_AHEAD" });
    const ok = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 1));
    await expect(
      recordPayments({ memberId: member.id, months: [ok], recordedById: recorder.id })
    ).resolves.toBeTruthy();
  });
});

describe("listDefaulters pagination", () => {
  it("paginates defaulters list with correct slice and metadata", async () => {
    const total = await countDefaulters(REF_NOW);
    const result = await listDefaulters({ asOf: REF_NOW, page: 1, pageSize: 2 });

    expect(result.total).toBe(total);
    expect(result.pageSize).toBe(2);
    expect(result.page).toBe(1);
    expect(result.defaulters.length).toBeLessThanOrEqual(2);

    if (total > 2) {
      const page2 = await listDefaulters({ asOf: REF_NOW, page: 2, pageSize: 2 });
      expect(page2.page).toBe(2);
      expect(page2.defaulters[0].id).not.toBe(result.defaulters[0].id);
    }
  });

  it("returns all defaulters when pageSize is not passed", async () => {
    const total = await countDefaulters(REF_NOW);
    const result = await listDefaulters({ asOf: REF_NOW });
    expect(result.defaulters.length).toBe(total);
    expect(result.total).toBe(total);
  });
});

