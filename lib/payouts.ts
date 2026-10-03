import "server-only";

import { prisma } from "@/lib/prisma";
import { auditCreate, auditUpdate } from "@/lib/audit";
import { getFundEligibilityDetail } from "@/lib/rules";
import { isPayoutApprovalRequired } from "@/lib/settings";
import type { RequestPayoutInput } from "@/lib/schemas/payout";

export class PayoutError extends Error {
  constructor(
    public code: "NOT_ELIGIBLE" | "NOT_FOUND" | "INVALID_STATE",
    message: string,
    public detail?: unknown
  ) {
    super(message);
  }
}

const PAYOUT_INCLUDE = {
  member: { select: { id: true, name: true, serialNo: true, status: true, cnic: true } },
  requestedBy: { select: { id: true, name: true } },
  vpDecisionBy: { select: { id: true, name: true } },
  presDecisionBy: { select: { id: true, name: true } },
} as const;

export type ListPayoutsFilters = {
  status?: string;
  payoutType?: string;
  memberId?: string;
  requestedById?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export function payoutsWhere(filters: ListPayoutsFilters = {}) {
  const insensitive = { mode: "insensitive" as const };
  const conditions: Record<string, unknown>[] = [];

  if (filters.status && filters.status !== "all") {
    conditions.push({ status: filters.status });
  }

  if (filters.payoutType && filters.payoutType !== "all") {
    conditions.push({ payoutType: filters.payoutType });
  }

  if (filters.memberId) {
    conditions.push({ memberId: filters.memberId });
  }

  if (filters.requestedById) {
    conditions.push({ requestedById: filters.requestedById });
  }

  if (filters.from || filters.to) {
    conditions.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    conditions.push({
      OR: [
        { member: { name: { contains: s, ...insensitive } } },
        { member: { serialNo: { contains: s, ...insensitive } } },
        { member: { cnic: { contains: s, ...insensitive } } },
        { reason: { contains: s, ...insensitive } },
        { requestedBy: { name: { contains: s, ...insensitive } } },
      ],
    });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

export async function countPayouts(filters: Omit<ListPayoutsFilters, "page" | "pageSize"> = {}) {
  return prisma.fundPayout.count({
    where: payoutsWhere(filters),
  });
}

export type PayoutsSummary = {
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
};

export async function getPayoutsSummary(
  filters: Omit<ListPayoutsFilters, "page" | "pageSize"> = {}
): Promise<PayoutsSummary> {
  const where = payoutsWhere(filters);
  const rows = await prisma.fundPayout.findMany({
    where,
    select: { amount: true, status: true },
  });

  let totalCount = 0;
  let totalAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  let rejectedCount = 0;
  let rejectedAmount = 0;

  for (const r of rows) {
    const amt = Number(r.amount);
    totalCount++;
    totalAmount += amt;

    if (r.status === "paid") {
      paidCount++;
      paidAmount += amt;
    } else if (
      r.status === "requested" ||
      r.status === "vp_approved" ||
      r.status === "president_approved"
    ) {
      pendingCount++;
      pendingAmount += amt;
    } else if (r.status === "vp_rejected" || r.status === "president_rejected") {
      rejectedCount++;
      rejectedAmount += amt;
    }
  }

  return {
    totalCount,
    totalAmount,
    paidCount,
    paidAmount,
    pendingCount,
    pendingAmount,
    rejectedCount,
    rejectedAmount,
  };
}

export async function listPayouts(filters: ListPayoutsFilters = {}) {
  const where = payoutsWhere(filters);
  const take = filters.pageSize;
  const skip = filters.pageSize && filters.page ? (Math.max(1, filters.page) - 1) * filters.pageSize : undefined;

  return prisma.fundPayout.findMany({
    where,
    include: PAYOUT_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(take !== undefined ? { take } : {}),
    ...(skip !== undefined ? { skip } : {}),
  });
}

export async function getPayoutById(id: string) {
  return prisma.fundPayout.findUnique({ where: { id }, include: PAYOUT_INCLUDE });
}

/** Strips the joined relation objects so audit entries hold only the payout row itself. */
function payoutRow<T extends { member?: unknown; requestedBy?: unknown; vpDecisionBy?: unknown; presDecisionBy?: unknown }>(
  p: T
) {
  const { member, requestedBy, vpDecisionBy, presDecisionBy, ...row } = p;
  void member;
  void requestedBy;
  void vpDecisionBy;
  void presDecisionBy;
  return row;
}

/**
 * Blocks the request with a NOT_ELIGIBLE error (carrying monthsActive /
 * eligibilityMonths so the caller can explain why) unless the member passes
 * isFundEligible. No cap on number or amount of claims — none is enforced
 * here by design, per the spec.
 *
 * When the requirePayoutApproval setting is off as of now, the payout skips the
 * VP/President chain and is created ready to pay (status "president_approved",
 * autoApproved true, both decision fields left empty — nobody decided). The
 * setting is read once, here, so payouts already in flight keep their chain.
 */
export async function requestPayout(
  input: RequestPayoutInput,
  requestedById: string,
  asOf: Date = new Date()
) {
  const member = await prisma.member.findUnique({ where: { id: input.memberId } });
  if (!member) throw new PayoutError("NOT_FOUND", "Member not found");

  const detail = await getFundEligibilityDetail(member, asOf);
  if (!detail.eligible) {
    throw new PayoutError(
      "NOT_ELIGIBLE",
      `This member has been active for ${detail.monthsActive} month(s); fund payouts require more than ${detail.eligibilityMonths}.`,
      detail
    );
  }

  const approvalRequired = await isPayoutApprovalRequired(asOf);

  return prisma.$transaction(async (tx) => {
    const payout = await tx.fundPayout.create({
      data: {
        memberId: input.memberId,
        payoutType: input.payoutType,
        amount: input.amount,
        reason: input.reason || null,
        status: approvalRequired ? "requested" : "president_approved",
        autoApproved: !approvalRequired,
        requestedById,
      },
      include: PAYOUT_INCLUDE,
    });
    await auditCreate(tx, {
      entityType: "FundPayout",
      record: payoutRow(payout),
      changedBy: requestedById,
      memberId: payout.memberId,
    });
    return payout;
  });
}

type Decision = "approve" | "reject";

/** Shared transition: guards the required current status, updates, and audits before/after + reason. */
async function transition(params: {
  id: string;
  requiredStatus: string;
  actionLabel: string;
  actorId: string;
  event: string;
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.fundPayout.findUnique({ where: { id: params.id } });
    if (!before) throw new PayoutError("NOT_FOUND", "Payout not found");
    if (before.status !== params.requiredStatus) {
      throw new PayoutError(
        "INVALID_STATE",
        `Cannot ${params.actionLabel} a payout with status "${before.status}".`
      );
    }
    const after = await tx.fundPayout.update({
      where: { id: params.id },
      data: params.data,
      include: PAYOUT_INCLUDE,
    });
    await auditUpdate(tx, {
      entityType: "FundPayout",
      before,
      after: payoutRow(after),
      changedBy: params.actorId,
      memberId: before.memberId,
      extra: { event: params.event, ...params.context },
    });
    return after;
  });
}

/**
 * Only valid from status "requested". A reject here is terminal by
 * construction: presidentDecision only ever accepts status "vp_approved", so
 * a payout sitting at "vp_rejected" can never reach the President's queue.
 */
export async function vpDecision(
  id: string,
  decision: Decision,
  reason: string | undefined,
  actorId: string
) {
  const now = new Date();
  return transition({
    id,
    requiredStatus: "requested",
    actionLabel: "record a VP decision on",
    actorId,
    event: decision === "approve" ? "vp_approved" : "vp_rejected",
    context: { decision, reason: reason ?? null },
    data:
      decision === "approve"
        ? { status: "vp_approved", vpDecisionById: actorId, vpDecisionAt: now }
        : {
            status: "vp_rejected",
            vpDecisionById: actorId,
            vpDecisionAt: now,
            vpRejectReason: reason,
          },
  });
}

/** Only valid from status "vp_approved" — this is what makes a VP rejection terminal. */
export async function presidentDecision(
  id: string,
  decision: Decision,
  reason: string | undefined,
  actorId: string
) {
  const now = new Date();
  return transition({
    id,
    requiredStatus: "vp_approved",
    actionLabel: "record a President decision on",
    actorId,
    event: decision === "approve" ? "president_approved" : "president_rejected",
    context: { decision, reason: reason ?? null },
    data:
      decision === "approve"
        ? { status: "president_approved", presDecisionById: actorId, presDecisionAt: now }
        : {
            status: "president_rejected",
            presDecisionById: actorId,
            presDecisionAt: now,
            presRejectReason: reason,
          },
  });
}

/** Only valid from status "president_approved". */
export async function markPaid(id: string, paidDate: Date | undefined, actorId: string) {
  return transition({
    id,
    requiredStatus: "president_approved",
    actionLabel: "mark as paid",
    actorId,
    event: "paid",
    data: { status: "paid", paidDate: paidDate ?? new Date() },
  });
}
