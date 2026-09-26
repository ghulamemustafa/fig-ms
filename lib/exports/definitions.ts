import "server-only";

import { prisma } from "@/lib/prisma";
import { fundEligibilityFromMonths } from "@/lib/rules";
import { getSettingValueAsOf } from "@/lib/settings";
import { dateRangeWhere, isoDate, isoMonth, paged, type ExportFilters } from "@/lib/exports/common";

export type Column<R> = {
  header: string;
  value: (row: R) => string | number;
  /** Relative width in the PDF table. */
  flex?: number;
  align?: "left" | "right";
  /** Add a total for this column at the bottom of the PDF. */
  sum?: boolean;
};

export type ExportDef<R> = {
  title: string;
  filename: string;
  columns: Column<R>[];
  landscape?: boolean;
  rows: (filters: ExportFilters) => AsyncGenerator<R>;
};

const stamp = () => new Date().toISOString().slice(0, 10);
const yesNo = (b: boolean) => (b ? "Yes" : "No");
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const PAYOUT_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  vp_approved: "VP approved",
  vp_rejected: "VP rejected",
  president_approved: "President approved",
  president_rejected: "President rejected",
  paid: "Paid",
};

// --- Members ---

type MemberRow = {
  serialNo: string;
  name: string;
  cnic: string;
  mobile: string;
  status: string;
  originalJoinDate: Date;
  currentJoinDate: Date;
  fundEligible: boolean;
};

export const membersExport: ExportDef<MemberRow> = {
  title: "Members",
  filename: `members-${stamp()}`,
  columns: [
    { header: "Serial No", value: (r) => r.serialNo, flex: 1.2 },
    { header: "Name", value: (r) => r.name, flex: 2.4 },
    { header: "CNIC", value: (r) => r.cnic, flex: 2 },
    { header: "Mobile", value: (r) => r.mobile, flex: 1.7 },
    { header: "Status", value: (r) => cap(r.status), flex: 1 },
    { header: "Join Date", value: (r) => isoDate(r.originalJoinDate), flex: 1.3 },
    { header: "Current Join", value: (r) => isoDate(r.currentJoinDate), flex: 1.3 },
    { header: "Fund Eligible", value: (r) => yesNo(r.fundEligible), flex: 1.1 },
  ],
  async *rows(f) {
    const asOf = new Date();
    const eligibilityMonths = Number((await getSettingValueAsOf("eligibilityMonths", asOf)) ?? 0);
    const range = dateRangeWhere(f);
    const where = {
      ...(f.status ? { status: f.status } : {}),
      ...(range ? { originalJoinDate: range } : {}),
    };
    for await (const m of paged((cursor, take) =>
      prisma.member.findMany({
        where,
        orderBy: [{ serialNo: "asc" }, { id: "asc" }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    )) {
      yield { ...m, fundEligible: fundEligibilityFromMonths(m, eligibilityMonths, asOf).eligible };
    }
  },
};

// --- Payments ---

type PaymentRow = {
  receiptNo: string;
  paidDate: Date;
  monthCovered: Date;
  amount: number;
  wasDoubleFee: boolean;
  member: { serialNo: string; name: string };
  recordedBy: { name: string };
};

export const paymentsExport: ExportDef<PaymentRow> = {
  title: "Payments",
  filename: `payments-${stamp()}`,
  columns: [
    { header: "Receipt No", value: (r) => r.receiptNo, flex: 1.5 },
    { header: "Paid Date", value: (r) => isoDate(r.paidDate), flex: 1.3 },
    { header: "Serial No", value: (r) => r.member.serialNo, flex: 1.2 },
    { header: "Member", value: (r) => r.member.name, flex: 2.4 },
    { header: "Month Covered", value: (r) => isoMonth(r.monthCovered), flex: 1.7 },
    { header: "Amount", value: (r) => r.amount, flex: 1, align: "right", sum: true },
    { header: "Double Fee", value: (r) => yesNo(r.wasDoubleFee), flex: 1.2 },
    { header: "Recorded By", value: (r) => r.recordedBy.name, flex: 1.8 },
  ],
  async *rows(f) {
    const range = dateRangeWhere(f);
    const where = { ...(range ? { paidDate: range } : {}), ...(f.memberId ? { memberId: f.memberId } : {}) };
    for await (const p of paged((cursor, take) =>
      prisma.payment.findMany({
        where,
        include: { member: { select: { serialNo: true, name: true } }, recordedBy: { select: { name: true } } },
        orderBy: [{ paidDate: "asc" }, { id: "asc" }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    )) {
      yield { ...p, amount: Number(p.amount) };
    }
  },
};

// --- Payouts ---

type PayoutRow = {
  member: { serialNo: string; name: string };
  payoutType: string;
  amount: number;
  status: string;
  reason: string | null;
  requestedBy: { name: string };
  vpDecisionBy: { name: string } | null;
  vpDecisionAt: Date | null;
  vpRejectReason: string | null;
  presDecisionBy: { name: string } | null;
  presDecisionAt: Date | null;
  presRejectReason: string | null;
  paidDate: Date | null;
  createdAt: Date;
};

export const payoutsExport: ExportDef<PayoutRow> = {
  title: "Payouts",
  filename: `payouts-${stamp()}`,
  landscape: true,
  columns: [
    { header: "Serial No", value: (r) => r.member.serialNo, flex: 1 },
    { header: "Member", value: (r) => r.member.name, flex: 2 },
    { header: "Type", value: (r) => cap(r.payoutType), flex: 1 },
    { header: "Amount", value: (r) => r.amount, flex: 1, align: "right", sum: true },
    { header: "Status", value: (r) => PAYOUT_STATUS_LABELS[r.status] ?? r.status, flex: 1.5 },
    { header: "Requested", value: (r) => isoDate(r.createdAt), flex: 1.1 },
    { header: "Requested By", value: (r) => r.requestedBy.name, flex: 1.5 },
    { header: "VP Decision", value: (r) => (r.vpDecisionBy ? `${r.vpDecisionBy.name} ${isoDate(r.vpDecisionAt)}` : ""), flex: 2 },
    { header: "President Decision", value: (r) => (r.presDecisionBy ? `${r.presDecisionBy.name} ${isoDate(r.presDecisionAt)}` : ""), flex: 2 },
    { header: "Paid Date", value: (r) => isoDate(r.paidDate), flex: 1.1 },
    { header: "Rejection Reason", value: (r) => r.vpRejectReason ?? r.presRejectReason ?? "", flex: 2.2 },
    { header: "Request Reason", value: (r) => r.reason ?? "", flex: 2.2 },
  ],
  async *rows(f) {
    // The date range applies to when the payout was requested.
    const range = dateRangeWhere(f);
    const where = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.type ? { payoutType: f.type } : {}),
      ...(f.memberId ? { memberId: f.memberId } : {}),
      ...(range ? { createdAt: range } : {}),
    };
    for await (const p of paged((cursor, take) =>
      prisma.fundPayout.findMany({
        where,
        include: {
          member: { select: { serialNo: true, name: true } },
          requestedBy: { select: { name: true } },
          vpDecisionBy: { select: { name: true } },
          presDecisionBy: { select: { name: true } },
        },
        orderBy: { id: "asc" },
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    )) {
      yield { ...p, amount: Number(p.amount) };
    }
  },
};

// --- Ledgers ---

type IncomeRow = { date: Date; source: string; amount: number; description: string | null };
export const incomeExport: ExportDef<IncomeRow> = {
  title: "Other Income",
  filename: `income-${stamp()}`,
  columns: [
    { header: "Date", value: (r) => isoDate(r.date), flex: 1.2 },
    { header: "Source", value: (r) => r.source, flex: 2.5 },
    { header: "Amount", value: (r) => r.amount, flex: 1.2, align: "right", sum: true },
    { header: "Description", value: (r) => r.description ?? "", flex: 3 },
  ],
  async *rows(f) {
    const range = dateRangeWhere(f);
    const where = { deletedAt: null, ...(range ? { date: range } : {}) };
    for await (const r of paged((cursor, take) =>
      prisma.otherIncome.findMany({
        where,
        orderBy: [{ date: "asc" }, { id: "asc" }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    ))
      yield { ...r, amount: Number(r.amount) };
  },
};

type DonationRow = {
  date: Date;
  donorName: string;
  donorContact: string | null;
  amount: number;
  notes: string | null;
};
export const donationsExport: ExportDef<DonationRow> = {
  title: "Donations",
  filename: `donations-${stamp()}`,
  columns: [
    { header: "Date", value: (r) => isoDate(r.date), flex: 1.2 },
    { header: "Donor", value: (r) => r.donorName, flex: 2.2 },
    { header: "Contact", value: (r) => r.donorContact ?? "", flex: 1.6 },
    { header: "Amount", value: (r) => r.amount, flex: 1.2, align: "right", sum: true },
    { header: "Notes", value: (r) => r.notes ?? "", flex: 2.6 },
  ],
  async *rows(f) {
    const range = dateRangeWhere(f);
    const where = { deletedAt: null, ...(range ? { date: range } : {}) };
    for await (const r of paged((cursor, take) =>
      prisma.donation.findMany({
        where,
        orderBy: [{ date: "asc" }, { id: "asc" }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    ))
      yield { ...r, amount: Number(r.amount) };
  },
};

type ExpenseRow = {
  date: Date;
  category: string;
  amount: number;
  description: string | null;
  approvedBy: string | null;
};
export const expensesExport: ExportDef<ExpenseRow> = {
  title: "Expenses",
  filename: `expenses-${stamp()}`,
  columns: [
    { header: "Date", value: (r) => isoDate(r.date), flex: 1.2 },
    { header: "Category", value: (r) => r.category, flex: 1.8 },
    { header: "Amount", value: (r) => r.amount, flex: 1.2, align: "right", sum: true },
    { header: "Description", value: (r) => r.description ?? "", flex: 2.6 },
    { header: "Approved By", value: (r) => r.approvedBy ?? "", flex: 1.6 },
  ],
  async *rows(f) {
    const range = dateRangeWhere(f);
    const where = {
      deletedAt: null,
      ...(range ? { date: range } : {}),
      ...(f.category ? { category: f.category } : {}),
    };
    for await (const r of paged((cursor, take) =>
      prisma.expense.findMany({
        where,
        orderBy: [{ date: "asc" }, { id: "asc" }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
    ))
      yield { ...r, amount: Number(r.amount) };
  },
};

export const TABLE_EXPORTS = {
  members: membersExport,
  payments: paymentsExport,
  payouts: payoutsExport,
  income: incomeExport,
  donations: donationsExport,
  expenses: expensesExport,
} as const;
