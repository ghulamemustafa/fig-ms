import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  createIncome,
  getIncomeTotal,
  softDeleteIncome,
  listIncome,
  countIncome,
  createDonation,
  getDonationTotal,
  softDeleteDonation,
  listDonations,
  countDonations,
  createExpense,
  getExpenseTotal,
  listExpenseCategories,
  listExpenses,
  countExpenses,
} from "@/lib/ledgers";

/** Marker used to find + clean up everything this suite creates, regardless of which test created it. */
const MARKER = "LEDGER-TEST-MARKER";

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

let actor: string;

async function cleanup() {
  const income = await prisma.otherIncome.findMany({ where: { source: { contains: MARKER } }, select: { id: true } });
  const expenses = await prisma.expense.findMany({ where: { category: { contains: MARKER } }, select: { id: true } });
  const donations = await prisma.donation.findMany({ where: { donorName: { contains: MARKER } }, select: { id: true } });
  const ids = [...income, ...expenses, ...donations].map((r) => r.id);
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  }
  await prisma.otherIncome.deleteMany({ where: { source: { contains: MARKER } } });
  await prisma.expense.deleteMany({ where: { category: { contains: MARKER } } });
  await prisma.donation.deleteMany({ where: { donorName: { contains: MARKER } } });
}

beforeAll(async () => {
  actor = (await prisma.user.findFirstOrThrow({ where: { role: "treasurer" } })).id;
  await cleanup();
});
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("income totals", () => {
  it("sums only non-deleted entries", async () => {
    const a = await createIncome({
      date: utcDate(2026, 6, 1),
      source: `${MARKER}-a`,
      amount: 1000,
    }, actor);
    await createIncome({ date: utcDate(2026, 6, 2), source: `${MARKER}-b`, amount: 500 }, actor);

    const beforeDelete = await getIncomeTotal();
    await softDeleteIncome(a.id, actor);
    const afterDelete = await getIncomeTotal();

    expect(afterDelete).toBe(beforeDelete - 1000);

    const entries = await listIncome({});
    expect(entries.find((e) => e.id === a.id)).toBeUndefined();
  });

  it("filters by date range", async () => {
    await createIncome({ date: utcDate(2020, 1, 1), source: `${MARKER}-old`, amount: 999 }, actor);
    await createIncome({ date: utcDate(2026, 6, 15), source: `${MARKER}-in-range`, amount: 250 }, actor);

    const total = await getIncomeTotal({
      from: utcDate(2026, 6, 1),
      to: utcDate(2026, 6, 30),
    });

    // The 2020 entry and any out-of-range fixtures must not be counted.
    const entries = await listIncome({
      from: utcDate(2026, 6, 1),
      to: utcDate(2026, 6, 30),
    });
    expect(entries.every((e) => e.date >= utcDate(2026, 6, 1) && e.date <= utcDate(2026, 6, 30))).toBe(
      true
    );
    expect(total).toBeGreaterThanOrEqual(250);
  });
});

describe("expense categories and totals", () => {
  it("distinct categories list and per-category totals stay consistent", async () => {
    await createExpense({
      date: utcDate(2026, 6, 1),
      category: `${MARKER}-Fuel`,
      amount: 300,
    }, actor);
    await createExpense({
      date: utcDate(2026, 6, 2),
      category: `${MARKER}-Fuel`,
      amount: 200,
    }, actor);

    const categories = await listExpenseCategories();
    expect(categories).toContain(`${MARKER}-Fuel`);

    const total = await getExpenseTotal({ category: `${MARKER}-Fuel` });
    expect(total).toBe(500);
  });
});

describe("pagination across ledgers", () => {
  it("paginates income entries correctly", async () => {
    for (let i = 1; i <= 5; i++) {
      await createIncome(
        {
          date: utcDate(2048, 7, i),
          source: `${MARKER}-inc-${i}`,
          amount: 100 * i,
        },
        actor
      );
    }

    const count = await countIncome({
      from: utcDate(2048, 7, 1),
      to: utcDate(2048, 7, 10),
    });
    expect(count).toBe(5);

    const page1 = await listIncome({
      from: utcDate(2048, 7, 1),
      to: utcDate(2048, 7, 10),
      page: 1,
      pageSize: 2,
    });
    expect(page1).toHaveLength(2);
    // Ordered by date desc: July 5 and July 4
    expect(page1[0].source).toBe(`${MARKER}-inc-5`);
    expect(page1[1].source).toBe(`${MARKER}-inc-4`);

    const page2 = await listIncome({
      from: utcDate(2048, 7, 1),
      to: utcDate(2048, 7, 10),
      page: 2,
      pageSize: 2,
    });
    expect(page2).toHaveLength(2);
    expect(page2[0].source).toBe(`${MARKER}-inc-3`);
    expect(page2[1].source).toBe(`${MARKER}-inc-2`);

    const page3 = await listIncome({
      from: utcDate(2048, 7, 1),
      to: utcDate(2048, 7, 10),
      page: 3,
      pageSize: 2,
    });
    expect(page3).toHaveLength(1);
    expect(page3[0].source).toBe(`${MARKER}-inc-1`);
  });

  it("paginates donation entries correctly", async () => {
    for (let i = 1; i <= 3; i++) {
      await createDonation(
        {
          date: utcDate(2048, 8, i),
          donorName: `${MARKER}-donor-${i}`,
          amount: 500 * i,
        },
        actor
      );
    }

    const count = await countDonations({
      from: utcDate(2048, 8, 1),
      to: utcDate(2048, 8, 10),
    });
    expect(count).toBe(3);

    const page1 = await listDonations({
      from: utcDate(2048, 8, 1),
      to: utcDate(2048, 8, 10),
      page: 1,
      pageSize: 2,
    });
    expect(page1).toHaveLength(2);
    expect(page1[0].donorName).toBe(`${MARKER}-donor-3`);
    expect(page1[1].donorName).toBe(`${MARKER}-donor-2`);

    const page2 = await listDonations({
      from: utcDate(2048, 8, 1),
      to: utcDate(2048, 8, 10),
      page: 2,
      pageSize: 2,
    });
    expect(page2).toHaveLength(1);
    expect(page2[0].donorName).toBe(`${MARKER}-donor-1`);
  });

  it("paginates expense entries and filters by category", async () => {
    for (let i = 1; i <= 4; i++) {
      await createExpense(
        {
          date: utcDate(2048, 9, i),
          category: `${MARKER}-Ops`,
          amount: 250 * i,
        },
        actor
      );
    }

    const count = await countExpenses({ category: `${MARKER}-Ops` });
    expect(count).toBe(4);

    const page1 = await listExpenses({
      category: `${MARKER}-Ops`,
      page: 1,
      pageSize: 3,
    });
    expect(page1).toHaveLength(3);

    const page2 = await listExpenses({
      category: `${MARKER}-Ops`,
      page: 2,
      pageSize: 3,
    });
    expect(page2).toHaveLength(1);
  });
});

describe("ledger descriptions and notes", () => {
  it("persists and retrieves income description", async () => {
    const inc = await createIncome(
      {
        date: utcDate(2026, 6, 10),
        source: `${MARKER}-scrap-sale`,
        amount: 450,
        description: "Sale of old office chairs",
      },
      actor
    );

    const rows = await listIncome({ from: utcDate(2026, 6, 10), to: utcDate(2026, 6, 10) });
    const found = rows.find((r) => r.id === inc.id);
    expect(found?.description).toBe("Sale of old office chairs");
  });

  it("persists and retrieves expense description", async () => {
    const exp = await createExpense(
      {
        date: utcDate(2026, 6, 11),
        category: `${MARKER}-Stationery`,
        amount: 150,
        description: "Receipt books printing",
      },
      actor
    );

    const rows = await listExpenses({ from: utcDate(2026, 6, 11), to: utcDate(2026, 6, 11) });
    const found = rows.find((r) => r.id === exp.id);
    expect(found?.description).toBe("Receipt books printing");
  });

  it("persists and retrieves donation notes", async () => {
    const don = await createDonation(
      {
        date: utcDate(2026, 6, 12),
        donorName: `${MARKER}-Haji Sahab`,
        amount: 5000,
        notes: "For Ramadan iftar fund",
      },
      actor
    );

    const rows = await listDonations({ from: utcDate(2026, 6, 12), to: utcDate(2026, 6, 12) });
    const found = rows.find((r) => r.id === don.id);
    expect(found?.notes).toBe("For Ramadan iftar fund");
  });
});

