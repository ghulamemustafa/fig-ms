import "server-only";

import { prisma } from "@/lib/prisma";
import { auditCreate, auditUpdate } from "@/lib/audit";
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

export async function createIncome(input: IncomeEntryInput, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.otherIncome.create({ data: input });
    await auditCreate(tx, { entityType: "OtherIncome", record, changedBy });
    return record;
  });
}

export async function updateIncome(id: string, input: IncomeEntryInput, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.otherIncome.findUniqueOrThrow({ where: { id } });
    const after = await tx.otherIncome.update({ where: { id }, data: input });
    await auditUpdate(tx, { entityType: "OtherIncome", before, after, changedBy });
    return after;
  });
}

/** Soft delete: the row stays (deletedAt set); the audit entry keeps a full snapshot. */
export async function softDeleteIncome(id: string, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.otherIncome.findUniqueOrThrow({ where: { id } });
    const after = await tx.otherIncome.update({ where: { id }, data: { deletedAt: new Date() } });
    await auditUpdate(tx, {
      entityType: "OtherIncome",
      before,
      after,
      changedBy,
      action: "delete",
      extra: { event: "soft_deleted", snapshot: before },
    });
    return after;
  });
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

export async function createDonation(input: DonationEntryInput, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.donation.create({ data: input });
    await auditCreate(tx, { entityType: "Donation", record, changedBy });
    return record;
  });
}

export async function updateDonation(id: string, input: DonationEntryInput, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.donation.findUniqueOrThrow({ where: { id } });
    const after = await tx.donation.update({ where: { id }, data: input });
    await auditUpdate(tx, { entityType: "Donation", before, after, changedBy });
    return after;
  });
}

/** Soft delete: the row stays (deletedAt set); the audit entry keeps a full snapshot. */
export async function softDeleteDonation(id: string, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.donation.findUniqueOrThrow({ where: { id } });
    const after = await tx.donation.update({ where: { id }, data: { deletedAt: new Date() } });
    await auditUpdate(tx, {
      entityType: "Donation",
      before,
      after,
      changedBy,
      action: "delete",
      extra: { event: "soft_deleted", snapshot: before },
    });
    return after;
  });
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

export async function createExpense(input: ExpenseEntryInput, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.expense.create({ data: input });
    await auditCreate(tx, { entityType: "Expense", record, changedBy });
    return record;
  });
}

export async function updateExpense(id: string, input: ExpenseEntryInput, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.expense.findUniqueOrThrow({ where: { id } });
    const after = await tx.expense.update({ where: { id }, data: input });
    await auditUpdate(tx, { entityType: "Expense", before, after, changedBy });
    return after;
  });
}

/** Soft delete: the row stays (deletedAt set); the audit entry keeps a full snapshot. */
export async function softDeleteExpense(id: string, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.expense.findUniqueOrThrow({ where: { id } });
    const after = await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await auditUpdate(tx, {
      entityType: "Expense",
      before,
      after,
      changedBy,
      action: "delete",
      extra: { event: "soft_deleted", snapshot: before },
    });
    return after;
  });
}
