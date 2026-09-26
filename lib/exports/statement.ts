import "server-only";

import { prisma } from "@/lib/prisma";

export type Statement = {
  fromLabel: string;
  toLabel: string;
  income: { feesCollected: number; feeCount: number; otherIncome: number; donations: number; total: number };
  outflow: {
    expensesByCategory: { category: string; amount: number }[];
    expensesTotal: number;
    payoutsByType: { type: string; amount: number; count: number }[];
    payoutsTotal: number;
    total: number;
  };
  net: number;
  openingBalance: number;
  closingBalance: number;
  monthly: { month: string; income: number; outflow: number }[];
};

const n = (v: unknown) => Number(v ?? 0);

type MonthRow = { month: string; total: unknown };

/** Cash-basis statement: fees by paidDate, ledgers by date, payouts by paidDate. */
export async function buildStatement(from: Date, toExclusive: Date, fromLabel: string, toLabel: string): Promise<Statement> {
  const inRange = { gte: from, lt: toExclusive };
  const before = { lt: from };

  const [
    fees,
    other,
    donations,
    expenseGroups,
    payoutGroups,
    preFees,
    preOther,
    preDonations,
    preExpenses,
    prePayouts,
    mFees,
    mOther,
    mDonations,
    mExpenses,
    mPayouts,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { paidDate: inRange }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.otherIncome.aggregate({ where: { deletedAt: null, date: inRange }, _sum: { amount: true } }),
    prisma.donation.aggregate({ where: { deletedAt: null, date: inRange }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["category"], where: { deletedAt: null, date: inRange }, _sum: { amount: true }, orderBy: { category: "asc" } }),
    prisma.fundPayout.groupBy({ by: ["payoutType"], where: { status: "paid", paidDate: inRange }, _sum: { amount: true }, _count: { _all: true }, orderBy: { payoutType: "asc" } }),
    prisma.payment.aggregate({ where: { paidDate: before }, _sum: { amount: true } }),
    prisma.otherIncome.aggregate({ where: { deletedAt: null, date: before }, _sum: { amount: true } }),
    prisma.donation.aggregate({ where: { deletedAt: null, date: before }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { deletedAt: null, date: before }, _sum: { amount: true } }),
    prisma.fundPayout.aggregate({ where: { status: "paid", paidDate: before }, _sum: { amount: true } }),
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date_trunc('month', "paidDate"), 'YYYY-MM') AS month, SUM(amount) AS total FROM "Payment" WHERE "paidDate" >= ${from} AND "paidDate" < ${toExclusive} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month, SUM(amount) AS total FROM "OtherIncome" WHERE "deletedAt" IS NULL AND "date" >= ${from} AND "date" < ${toExclusive} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month, SUM(amount) AS total FROM "Donation" WHERE "deletedAt" IS NULL AND "date" >= ${from} AND "date" < ${toExclusive} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month, SUM(amount) AS total FROM "Expense" WHERE "deletedAt" IS NULL AND "date" >= ${from} AND "date" < ${toExclusive} GROUP BY 1`,
    prisma.$queryRaw<MonthRow[]>`SELECT to_char(date_trunc('month', "paidDate"), 'YYYY-MM') AS month, SUM(amount) AS total FROM "FundPayout" WHERE status = 'paid' AND "paidDate" >= ${from} AND "paidDate" < ${toExclusive} GROUP BY 1`,
  ]);

  const income = {
    feesCollected: n(fees._sum.amount),
    feeCount: fees._count._all,
    otherIncome: n(other._sum.amount),
    donations: n(donations._sum.amount),
    total: 0,
  };
  income.total = income.feesCollected + income.otherIncome + income.donations;

  const expensesByCategory = expenseGroups.map((g) => ({ category: g.category, amount: n(g._sum.amount) }));
  const payoutsByType = payoutGroups.map((g) => ({ type: g.payoutType, amount: n(g._sum.amount), count: g._count._all }));
  const expensesTotal = expensesByCategory.reduce((s, e) => s + e.amount, 0);
  const payoutsTotal = payoutsByType.reduce((s, p) => s + p.amount, 0);
  const outflow = { expensesByCategory, expensesTotal, payoutsByType, payoutsTotal, total: expensesTotal + payoutsTotal };

  const net = income.total - outflow.total;
  const openingBalance =
    n(preFees._sum.amount) + n(preOther._sum.amount) + n(preDonations._sum.amount) - n(preExpenses._sum.amount) - n(prePayouts._sum.amount);

  // Every month in the period, even empty ones.
  const monthly: Statement["monthly"] = [];
  const byMonth = (rows: MonthRow[]) => new Map(rows.map((r) => [r.month, n(r.total)]));
  const inc = [byMonth(mFees), byMonth(mOther), byMonth(mDonations)];
  const out = [byMonth(mExpenses), byMonth(mPayouts)];
  const last = new Date(toExclusive.getTime() - 1);
  for (
    let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    d <= last;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    const key = d.toISOString().slice(0, 7);
    monthly.push({
      month: key,
      income: inc.reduce((s, m) => s + (m.get(key) ?? 0), 0),
      outflow: out.reduce((s, m) => s + (m.get(key) ?? 0), 0),
    });
  }

  return { fromLabel, toLabel, income, outflow, net, openingBalance, closingBalance: openingBalance + net, monthly };
}
