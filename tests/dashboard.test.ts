import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getDashboardSummary } from "@/lib/dashboard";

describe("getDashboardSummary", () => {
  const KEY = "requirePayoutApproval";
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.setting.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  it("reflects requirePayoutApproval when true", async () => {
    const row = await prisma.setting.create({
      data: {
        key: KEY,
        value: "true",
        effectiveFrom: new Date("2099-01-01T00:00:00.000Z"),
      },
    });
    createdIds.push(row.id);

    const summary = await getDashboardSummary(new Date("2099-01-02T00:00:00.000Z"));
    expect(summary.requirePayoutApproval).toBe(true);
    expect(summary.pendingApprovals).toBeDefined();
    expect(typeof summary.pendingApprovals.vp).toBe("number");
    expect(typeof summary.pendingApprovals.president).toBe("number");
  });

  it("reflects requirePayoutApproval when false", async () => {
    const row = await prisma.setting.create({
      data: {
        key: KEY,
        value: "false",
        effectiveFrom: new Date("2099-02-01T00:00:00.000Z"),
      },
    });
    createdIds.push(row.id);

    const summary = await getDashboardSummary(new Date("2099-02-02T00:00:00.000Z"));
    expect(summary.requirePayoutApproval).toBe(false);
  });

  it("includes separate payout series in trend data", async () => {
    const summary = await getDashboardSummary();
    expect(summary.trend).toHaveLength(6);
    for (const point of summary.trend) {
      expect(typeof point.month).toBe("string");
      expect(typeof point.income).toBe("number");
      expect(typeof point.expense).toBe("number");
      expect(typeof point.payout).toBe("number");
    }
  });

  it("accurately records a paid payout in the corresponding trend month", async () => {
    const asOf = new Date(Date.UTC(2098, 5, 15)); // June 2098
    const user = await prisma.user.findFirst();
    if (!user) return;

    const member = await prisma.member.create({
      data: {
        serialNo: "DASH-TREND-TEST-1",
        name: "Dash Trend Member",
        fatherName: "Test Father",
        cnic: "99999-DASH-1",
        mobile: "0300-1112233",
        address: "Test address",
        maritalStatus: "single",
        occupation: "Tester",
        income: 5000,
        dob: new Date("1990-01-01T00:00:00.000Z"),
        originalJoinDate: new Date("2090-01-01T00:00:00.000Z"),
        currentJoinDate: new Date("2090-01-01T00:00:00.000Z"),
        status: "active",
      },
    });

    const payout = await prisma.fundPayout.create({
      data: {
        memberId: member.id,
        payoutType: "other",
        amount: 45000,
        status: "paid",
        requestedById: user.id,
        paidDate: new Date(Date.UTC(2098, 5, 10)),
      },
    });

    try {
      const summary = await getDashboardSummary(asOf);
      const junePoint = summary.trend.find((t) => t.month === "2098-06");
      expect(junePoint).toBeDefined();
      expect(junePoint?.payout).toBe(45000);
      expect(junePoint?.expense).toBe(0);
    } finally {
      await prisma.fundPayout.delete({ where: { id: payout.id } });
      await prisma.member.delete({ where: { id: member.id } });
    }
  });

  it("sorts recent payouts by createdAt descending instead of id", async () => {
    const user = await prisma.user.findFirst();
    if (!user) return;

    const member = await prisma.member.create({
      data: {
        serialNo: "DASH-SORT-TEST-1",
        name: "Dash Sort Member",
        fatherName: "Test Father",
        cnic: "99999-DASH-SORT-1",
        mobile: "0300-9998877",
        address: "Test address",
        maritalStatus: "single",
        occupation: "Tester",
        income: 5000,
        dob: new Date("1990-01-01T00:00:00.000Z"),
        originalJoinDate: new Date("2090-01-01T00:00:00.000Z"),
        currentJoinDate: new Date("2090-01-01T00:00:00.000Z"),
        status: "active",
      },
    });

    // Payout1 is created first (smaller id), but has a later createdAt date
    // Payout2 is created second (larger id), but has an earlier createdAt date
    const payout1 = await prisma.fundPayout.create({
      data: {
        memberId: member.id,
        payoutType: "funeral",
        amount: 10000,
        status: "requested",
        requestedById: user.id,
        createdAt: new Date("2099-05-10T12:00:00.000Z"),
      },
    });

    const payout2 = await prisma.fundPayout.create({
      data: {
        memberId: member.id,
        payoutType: "widow",
        amount: 20000,
        status: "requested",
        requestedById: user.id,
        createdAt: new Date("2099-05-01T12:00:00.000Z"),
      },
    });

    try {
      const summary = await getDashboardSummary();
      const p1Index = summary.recentPayouts.findIndex((p) => p.id === payout1.id);
      const p2Index = summary.recentPayouts.findIndex((p) => p.id === payout2.id);

      expect(p1Index).toBeGreaterThanOrEqual(0);
      expect(p2Index).toBeGreaterThanOrEqual(0);
      expect(p1Index).toBeLessThan(p2Index);
    } finally {
      await prisma.fundPayout.deleteMany({ where: { id: { in: [payout1.id, payout2.id] } } });
      await prisma.member.delete({ where: { id: member.id } });
    }
  });
});

