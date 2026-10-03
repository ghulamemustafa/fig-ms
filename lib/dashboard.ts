import "server-only";

import { prisma } from "@/lib/prisma";
import { getDefaulters } from "@/lib/payments";
import { feeFromSettings, getFeeSettingsAsOf } from "@/lib/rules";
import { getDonationTotal, getExpenseTotal, getIncomeTotal } from "@/lib/ledgers";
import { isPayoutApprovalRequired } from "@/lib/settings";

const TREND_MONTHS = 6;

function startOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonthsUTC(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

export type DashboardSummary = {
  asOf: string;
  members: { active: number; removed: number; deceased: number; newThisMonth: number };
  collection: { collected: number; expected: number; outstanding: number };
  defaulters: { one: number; two: number; threePlus: number };
  fund: {
    paymentsTotal: number;
    otherIncomeTotal: number;
    donationsTotal: number;
    expensesTotal: number;
    paidPayoutsTotal: number;
    balance: number;
  };
  trend: { month: string; income: number; expense: number }[];
  recentPayouts: {
    id: string;
    memberId: string;
    memberName: string;
    payoutType: string;
    amount: number;
    status: string;
  }[];
  pendingApprovals: { vp: number; president: number };
  requirePayoutApproval: boolean;
};

export async function getDashboardSummary(asOf: Date = new Date()): Promise<DashboardSummary> {
  const monthStart = startOfMonthUTC(asOf);
  const nextMonthStart = addMonthsUTC(monthStart, 1);
  const trendStart = addMonthsUTC(monthStart, -(TREND_MONTHS - 1));

  const [
    statusGroups,
    newThisMonth,
    collectedAgg,
    activeMembers,
    feeSettings,
    defaulters,
    allPaymentsAgg,
    incomeTotal,
    donationsTotal,
    expensesTotal,
    paidPayoutsAgg,
    trendPayments,
    trendIncome,
    trendDonations,
    trendExpenses,
    recentPayouts,
    pendingVp,
    pendingPresident,
    requirePayoutApproval,
  ] = await Promise.all([
    prisma.member.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.member.count({
      where: { originalJoinDate: { gte: monthStart, lt: nextMonthStart } },
    }),
    prisma.payment.aggregate({
      where: { monthCovered: monthStart },
      _sum: { amount: true },
    }),
    prisma.member.findMany({
      where: { status: "active" },
      select: { originalJoinDate: true, currentJoinDate: true },
    }),
    getFeeSettingsAsOf(monthStart),
    getDefaulters(asOf),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    getIncomeTotal(),
    getDonationTotal(),
    getExpenseTotal(),
    prisma.fundPayout.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { paidDate: { gte: trendStart, lt: nextMonthStart } },
      select: { paidDate: true, amount: true },
    }),
    prisma.otherIncome.findMany({
      where: { deletedAt: null, date: { gte: trendStart, lt: nextMonthStart } },
      select: { date: true, amount: true },
    }),
    prisma.donation.findMany({
      where: { deletedAt: null, date: { gte: trendStart, lt: nextMonthStart } },
      select: { date: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, date: { gte: trendStart, lt: nextMonthStart } },
      select: { date: true, amount: true },
    }),
    prisma.fundPayout.findMany({
      take: 5,
      orderBy: { id: "desc" },
      include: { member: { select: { id: true, name: true } } },
    }),
    prisma.fundPayout.count({ where: { status: "requested" } }),
    prisma.fundPayout.count({ where: { status: "vp_approved" } }),
    isPayoutApprovalRequired(asOf),
  ]);

  const statusCount = (status: string) =>
    statusGroups.find((g) => g.status === status)?._count._all ?? 0;

  const collected = Number(collectedAgg._sum.amount ?? 0);
  const expected = activeMembers.reduce(
    (sum, m) => sum + feeFromSettings(m, monthStart, feeSettings),
    0
  );

  const paymentsTotal = Number(allPaymentsAgg._sum.amount ?? 0);
  const paidPayoutsTotal = Number(paidPayoutsAgg._sum.amount ?? 0);

  const trendMap = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < TREND_MONTHS; i++) {
    trendMap.set(monthKey(addMonthsUTC(trendStart, i)), { income: 0, expense: 0 });
  }
  const bucket = (date: Date, field: "income" | "expense", amount: unknown) => {
    const entry = trendMap.get(monthKey(date));
    if (entry) entry[field] += Number(amount);
  };
  trendPayments.forEach((p) => bucket(p.paidDate, "income", p.amount));
  trendIncome.forEach((e) => bucket(e.date, "income", e.amount));
  trendDonations.forEach((e) => bucket(e.date, "income", e.amount));
  trendExpenses.forEach((e) => bucket(e.date, "expense", e.amount));

  return {
    asOf: asOf.toISOString(),
    members: {
      active: statusCount("active"),
      removed: statusCount("removed"),
      deceased: statusCount("deceased"),
      newThisMonth,
    },
    collection: { collected, expected, outstanding: Math.max(expected - collected, 0) },
    defaulters: {
      one: defaulters.filter((d) => d.unpaidMonths === 1).length,
      two: defaulters.filter((d) => d.unpaidMonths === 2).length,
      threePlus: defaulters.filter((d) => d.unpaidMonths >= 3).length,
    },
    fund: {
      paymentsTotal,
      otherIncomeTotal: incomeTotal,
      donationsTotal,
      expensesTotal,
      paidPayoutsTotal,
      balance: paymentsTotal + incomeTotal + donationsTotal - expensesTotal - paidPayoutsTotal,
    },
    trend: Array.from(trendMap, ([month, v]) => ({ month, ...v })),
    recentPayouts: recentPayouts.map((p) => ({
      id: p.id,
      memberId: p.member.id,
      memberName: p.member.name,
      payoutType: p.payoutType,
      amount: Number(p.amount),
      status: p.status,
    })),
    pendingApprovals: { vp: pendingVp, president: pendingPresident },
    requirePayoutApproval,
  };
}
