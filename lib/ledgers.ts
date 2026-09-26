import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  DonationEntryInput,
  ExpenseEntryInput,
  IncomeEntryInput,
} from "@/lib/schemas/ledger";

export type DateRangeFilter = { from?: Date; to?: Date };

function dateWhere({ from, to }: DateRangeFilter) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

// --- OtherIncome ---

export async function listIncome(filters: DateRangeFilter) {
  return prisma.otherIncome.findMany({
    where: { deletedAt: null, ...(dateWhere(filters) ? { date: dateWhere(filters) } : {}) },
    orderBy: { date: "desc" },
  });
}

export async function getIncomeTotal(filters: DateRangeFilter = {}): Promise<number> {
  const result = await prisma.otherIncome.aggregate({
    where: { deletedAt: null, ...(dateWhere(filters) ? { date: dateWhere(filters) } : {}) },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

export async function createIncome(input: IncomeEntryInput) {
  return prisma.otherIncome.create({ data: input });
}

export async function updateIncome(id: string, input: IncomeEntryInput) {
  return prisma.otherIncome.update({ where: { id }, data: input });
}

export async function softDeleteIncome(id: string) {
  return prisma.otherIncome.update({ where: { id }, data: { deletedAt: new Date() } });
}

// --- Donation ---

export async function listDonations(filters: DateRangeFilter) {
  return prisma.donation.findMany({
    where: { deletedAt: null, ...(dateWhere(filters) ? { date: dateWhere(filters) } : {}) },
    orderBy: { date: "desc" },
  });
}

export async function getDonationTotal(filters: DateRangeFilter = {}): Promise<number> {
  const result = await prisma.donation.aggregate({
    where: { deletedAt: null, ...(dateWhere(filters) ? { date: dateWhere(filters) } : {}) },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

export async function createDonation(input: DonationEntryInput) {
  return prisma.donation.create({ data: input });
}

export async function updateDonation(id: string, input: DonationEntryInput) {
  return prisma.donation.update({ where: { id }, data: input });
}

export async function softDeleteDonation(id: string) {
  return prisma.donation.update({ where: { id }, data: { deletedAt: new Date() } });
}

// --- Expense ---

export type ExpenseFilter = DateRangeFilter & { category?: string };

export async function listExpenses(filters: ExpenseFilter) {
  return prisma.expense.findMany({
    where: {
      deletedAt: null,
      ...(dateWhere(filters) ? { date: dateWhere(filters) } : {}),
      ...(filters.category ? { category: filters.category } : {}),
    },
    orderBy: { date: "desc" },
  });
}

export async function getExpenseTotal(filters: ExpenseFilter = {}): Promise<number> {
  const result = await prisma.expense.aggregate({
    where: {
      deletedAt: null,
      ...(dateWhere(filters) ? { date: dateWhere(filters) } : {}),
      ...(filters.category ? { category: filters.category } : {}),
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

export async function listExpenseCategories(): Promise<string[]> {
  const rows = await prisma.expense.findMany({
    where: { deletedAt: null },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

export async function createExpense(input: ExpenseEntryInput) {
  return prisma.expense.create({ data: input });
}

export async function updateExpense(id: string, input: ExpenseEntryInput) {
  return prisma.expense.update({ where: { id }, data: input });
}

export async function softDeleteExpense(id: string) {
  return prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
}
