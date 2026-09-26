import "server-only";

import { prisma } from "@/lib/prisma";
import { auditCreate, auditUpdate } from "@/lib/audit";
import { getFundEligibilityDetail } from "@/lib/rules";
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
  member: { select: { id: true, name: true, serialNo: true, status: true } },
  requestedBy: { select: { id: true, name: true } },
  vpDecisionBy: { select: { id: true, name: true } },
  presDecisionBy: { select: { id: true, name: true } },
} as const;

export async function listPayouts(filters: {
  status?: string;
  memberId?: string;
  requestedById?: string;
}) {
  return prisma.fundPayout.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
    },
    include: PAYOUT_INCLUDE,
    orderBy: { id: "desc" },
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

  return prisma.$transaction(async (tx) => {
    const payout = await tx.fundPayout.create({
      data: {
        memberId: input.memberId,
        payoutType: input.payoutType,
        amount: input.amount,
        reason: input.reason || null,
        status: "requested",
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
