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
});
