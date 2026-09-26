import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  createIncome,
  getIncomeTotal,
  softDeleteIncome,
  listIncome,
  createExpense,
  getExpenseTotal,
  listExpenseCategories,
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
  const ids = [...income, ...expenses].map((r) => r.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.otherIncome.deleteMany({ where: { source: { contains: MARKER } } });
  await prisma.expense.deleteMany({ where: { category: { contains: MARKER } } });
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
