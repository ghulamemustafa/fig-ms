import "server-only";

import { prisma } from "@/lib/prisma";
import { auditUpdate, logAuditMany, type AuditEntry } from "@/lib/audit";
import { consecutiveUnpaidMonths, expectedFee } from "@/lib/rules";
import { getSettingValueAsOf } from "@/lib/settings";

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonthsUTC(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function dueDateForMonth(monthCovered: Date): Date {
  return new Date(
    Date.UTC(monthCovered.getUTCFullYear(), monthCovered.getUTCMonth(), 15)
  );
}

/** How many months beyond the current one a member may pay ahead ("the whole year"). */
export const MAX_ADVANCE_MONTHS = 12;

export interface MemberForOutstanding {
  currentJoinDate: Date;
  originalJoinDate: Date;
  status: string;
  removedDate: Date | null;
}

export interface PaymentMonthInfo {
  monthCovered: Date;
}

export type OutstandingMonth = {
  monthCovered: Date;
  dueDate: Date;
  amount: number;
  wasDoubleFee: boolean;
};

async function feeWithDoubleFlag(
  member: { originalJoinDate: Date; currentJoinDate: Date },
  monthCovered: Date
): Promise<{ amount: number; wasDoubleFee: boolean }> {
  const [amount, baseFeeStr] = await Promise.all([
    expectedFee(member, monthCovered),
    getSettingValueAsOf("baseFee", monthCovered),
  ]);
  const baseFee = Number(baseFeeStr ?? 0);
  return { amount, wasDoubleFee: amount > baseFee };
}

/**
 * Every unpaid month a member owes, in ascending order, with the locked fee
 * for each (respecting the 2x new-member window / historical settings).
 *
 * For an ACTIVE member: every month from currentJoinDate through the current
 * month (inclusive — this month's fee is collectable any time, not just
 * after the 15th) that has no Payment row.
 *
 * For a REMOVED member: arrears are capped at their removedDate (they didn't
 * owe fees while removed) PLUS the current month as a fresh "resume" charge
 * — computed as if they'd already been reactivated today (currentJoinDate =
 * asOf), so these arrears correctly get the normal rate, never 2x, per the
 * no-2x-on-rejoin rule. Recording a payment for any of these months is what
 * actually performs the reactivation (see recordPayments).
 */
export async function getOutstandingMonths(
  member: MemberForOutstanding,
  payments: PaymentMonthInfo[],
  asOf: Date = new Date()
): Promise<OutstandingMonth[]> {
  const paidMonths = new Set(
    payments.map((p) => startOfMonthUTC(p.monthCovered).getTime())
  );

  // Start from the month after their last recorded payment, not unconditionally
  // from currentJoinDate — a long-standing member's seed/demo history is often
  // only a few recent months, not a full ledger back to their real join date,
  // and re-verifying every month since then would also hit fee settings from
  // before they existed. Only fall back to currentJoinDate when there's no
  // payment history at all (a brand-new registration, or the removed-member
  // arrears case, matching the spec's "since currentJoinDate or last payment").
  // Months paid in advance are ignored here: they must not hide unpaid months before them.
  const currentMonth = startOfMonthUTC(asOf);
  const pastPaid = [...paidMonths].filter((t) => t <= currentMonth.getTime());
  const lastPaidMonth = pastPaid.length > 0 ? new Date(Math.max(...pastPaid)) : null;
  const startMonth = lastPaidMonth
    ? addMonthsUTC(lastPaidMonth, 1)
    : startOfMonthUTC(member.currentJoinDate);
  const isRemoved = member.status === "removed";
  const cap =
    isRemoved && member.removedDate
      ? startOfMonthUTC(member.removedDate)
      : currentMonth;

  const months: Date[] = [];
  for (
    let cursor = startMonth;
    cursor.getTime() <= cap.getTime();
    cursor = addMonthsUTC(cursor, 1)
  ) {
    if (!paidMonths.has(cursor.getTime())) months.push(cursor);
  }
  if (isRemoved && currentMonth.getTime() > cap.getTime()) {
    months.push(currentMonth);
  }

  // For a removed member, preview arrears as if already reactivated today —
  // matches what recordPayments actually does before charging these months.
  const feeContextMember = isRemoved
    ? { originalJoinDate: member.originalJoinDate, currentJoinDate: asOf }
    : member;

  return Promise.all(
    months.map(async (monthCovered) => {
      const { amount, wasDoubleFee } = await feeWithDoubleFlag(
        feeContextMember,
        monthCovered
      );
      return {
        monthCovered,
        dueDate: dueDateForMonth(monthCovered),
        amount,
        wasDoubleFee,
      };
    })
  );
}

/**
 * The next `MAX_ADVANCE_MONTHS` months after the current one that are not yet
 * paid, each with the fee that applies to that month (effective-dated settings
 * as of that month). Fees are locked when the payment is recorded.
 */
export async function getUpcomingMonths(
  member: { originalJoinDate: Date; currentJoinDate: Date; status: string },
  payments: PaymentMonthInfo[],
  asOf: Date = new Date()
): Promise<OutstandingMonth[]> {
  const paidMonths = new Set(payments.map((p) => startOfMonthUTC(p.monthCovered).getTime()));
  const currentMonth = startOfMonthUTC(asOf);
  const feeContextMember =
    member.status === "removed"
      ? { originalJoinDate: member.originalJoinDate, currentJoinDate: asOf }
      : member;

  const months: Date[] = [];
  for (let i = 1; i <= MAX_ADVANCE_MONTHS; i++) {
    const m = addMonthsUTC(currentMonth, i);
    if (!paidMonths.has(m.getTime())) months.push(m);
  }
  return Promise.all(
    months.map(async (monthCovered) => {
      const { amount, wasDoubleFee } = await feeWithDoubleFlag(feeContextMember, monthCovered);
      return { monthCovered, dueDate: dueDateForMonth(monthCovered), amount, wasDoubleFee };
    })
  );
}

/** Active members with 1+ consecutive unpaid months, worst-behind first. */
export async function getDefaulters(asOf: Date = new Date()) {
  const members = await prisma.member.findMany({
    where: { status: "active" },
    include: { payments: { select: { monthCovered: true } } },
  });

  return members
    .map((member) => ({
      ...member,
      unpaidMonths: consecutiveUnpaidMonths(member, member.payments, asOf),
    }))
    .filter((member) => member.unpaidMonths > 0)
    .sort((a, b) => b.unpaidMonths - a.unpaidMonths);
}

async function nextReceiptNo(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const last = await tx.payment.findFirst({ orderBy: { receiptNo: "desc" } });
  const lastSeq = last ? parseInt(last.receiptNo.replace(/\D/g, ""), 10) || 0 : 0;
  return `RC-${String(lastSeq + 1).padStart(6, "0")}`;
}

export class PaymentError extends Error {
  constructor(
    public code: "MEMBER_NOT_FOUND" | "REACTIVATION_REQUIRED" | "ALREADY_PAID" | "MEMBER_DECEASED" | "TOO_FAR_AHEAD",
    message: string
  ) {
    super(message);
  }
}

/**
 * Records one Payment per requested month (each independently a full-month
 * payment — this is just a UI convenience for paying several months in one
 * visit, e.g. clearing arrears). If the member is currently `removed`, this
 * also reactivates them (status -> active, currentJoinDate -> today,
 * clearing removedDate/removedReason) as part of the same transaction — the
 * caller must pass `confirmReactivation: true` or it's rejected, since
 * reactivating is a meaningful side effect the treasurer must explicitly opt
 * into, not something that happens implicitly.
 */
export async function recordPayments(params: {
  memberId: string;
  months: Date[];
  recordedById: string;
  confirmReactivation?: boolean;
}) {
  const { memberId, months, recordedById, confirmReactivation } = params;
  if (months.length === 0) {
    throw new PaymentError("ALREADY_PAID", "No months selected");
  }

  const lastAllowed = addMonthsUTC(startOfMonthUTC(new Date()), MAX_ADVANCE_MONTHS);
  if (months.some((m) => startOfMonthUTC(m).getTime() > lastAllowed.getTime())) {
    throw new PaymentError(
      "TOO_FAR_AHEAD",
      `Payments can be made at most ${MAX_ADVANCE_MONTHS} months in advance`
    );
  }

  return prisma.$transaction(async (tx) => {
    let member = await tx.member.findUnique({ where: { id: memberId } });
    if (!member) throw new PaymentError("MEMBER_NOT_FOUND", "Member not found");
    if (member.status === "deceased") {
      throw new PaymentError("MEMBER_DECEASED", "Cannot record a payment for a deceased member");
    }

    if (member.status === "removed") {
      if (!confirmReactivation) {
        throw new PaymentError(
          "REACTIVATION_REQUIRED",
          "This member is removed — confirm reactivation to record arrears"
        );
      }
      const beforeReactivation = member;
      member = await tx.member.update({
        where: { id: memberId },
        data: {
          status: "active",
          currentJoinDate: new Date(),
          removedDate: null,
          removedReason: null,
        },
      });
      await auditUpdate(tx, {
        entityType: "Member",
        before: beforeReactivation,
        after: member,
        changedBy: recordedById,
        memberId,
        extra: { event: "reactivated", via: "payment" },
      });
    }

    const existing = await tx.payment.findMany({
      where: { memberId },
      select: { monthCovered: true },
    });
    const alreadyPaid = new Set(
      existing.map((p) => startOfMonthUTC(p.monthCovered).getTime())
    );

    // One receipt number and one payment timestamp for the whole transaction: a
    // multi-month payment is a single receipt with one line item per month.
    // receiptNo is no longer unique per row, so serialize number allocation.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7001)`;
    const receiptNo = await nextReceiptNo(tx);
    const paidDate = new Date();
    const created = [];
    const auditEntries: AuditEntry[] = [];
    for (const monthCovered of months) {
      const normalizedMonth = startOfMonthUTC(monthCovered);
      if (alreadyPaid.has(normalizedMonth.getTime())) {
        throw new PaymentError(
          "ALREADY_PAID",
          `${normalizedMonth.toISOString().slice(0, 7)} is already paid`
        );
      }
      const { amount, wasDoubleFee } = await feeWithDoubleFlag(member, normalizedMonth);
      const payment = await tx.payment.create({
        data: {
          memberId,
          monthCovered: normalizedMonth,
          amount,
          wasDoubleFee,
          paidDate,
          dueDate: dueDateForMonth(normalizedMonth),
          receiptNo,
          recordedById,
        },
      });
      created.push(payment);
      auditEntries.push({
        entityType: "Payment",
        entityId: payment.id,
        action: "create",
        changedBy: recordedById,
        changes: payment,
        memberId,
      });
      alreadyPaid.add(normalizedMonth.getTime());
    }

    // One INSERT for all months — keeps the Collect Payment hot path to a single extra round trip.
    await logAuditMany(tx, auditEntries);

    return { payments: created, member };
  });
}
