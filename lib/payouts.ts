import "server-only";

import { prisma } from "@/lib/prisma";
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

  return prisma.fundPayout.create({
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
}

/**
 * Only valid from status "requested". A reject here is terminal by
 * construction: presidentDecision only ever accepts status "vp_approved", so
 * a payout sitting at "vp_rejected" can never reach the President's queue.
 */
export async function vpDecision(
  id: string,
  decision: "approve" | "reject",
  reason: string | undefined,
  actorId: string
) {
  const payout = await prisma.fundPayout.findUnique({ where: { id } });
  if (!payout) throw new PayoutError("NOT_FOUND", "Payout not found");
  if (payout.status !== "requested") {
    throw new PayoutError(
      "INVALID_STATE",
      `Cannot record a VP decision on a payout with status "${payout.status}".`
    );
  }

  return prisma.fundPayout.update({
    where: { id },
    data:
      decision === "approve"
        ? { status: "vp_approved", vpDecisionById: actorId, vpDecisionAt: new Date() }
        : {
            status: "vp_rejected",
            vpDecisionById: actorId,
            vpDecisionAt: new Date(),
            vpRejectReason: reason,
          },
    include: PAYOUT_INCLUDE,
  });
}

/** Only valid from status "vp_approved" — this is what makes a VP rejection terminal. */
export async function presidentDecision(
  id: string,
  decision: "approve" | "reject",
  reason: string | undefined,
  actorId: string
) {
  const payout = await prisma.fundPayout.findUnique({ where: { id } });
  if (!payout) throw new PayoutError("NOT_FOUND", "Payout not found");
  if (payout.status !== "vp_approved") {
    throw new PayoutError(
      "INVALID_STATE",
      `Cannot record a President decision on a payout with status "${payout.status}".`
    );
  }

  return prisma.fundPayout.update({
    where: { id },
    data:
      decision === "approve"
        ? { status: "president_approved", presDecisionById: actorId, presDecisionAt: new Date() }
        : {
            status: "president_rejected",
            presDecisionById: actorId,
            presDecisionAt: new Date(),
            presRejectReason: reason,
          },
    include: PAYOUT_INCLUDE,
  });
}

/** Only valid from status "president_approved". */
export async function markPaid(id: string, paidDate: Date | undefined) {
  const payout = await prisma.fundPayout.findUnique({ where: { id } });
  if (!payout) throw new PayoutError("NOT_FOUND", "Payout not found");
  if (payout.status !== "president_approved") {
    throw new PayoutError(
      "INVALID_STATE",
      `Cannot mark a payout with status "${payout.status}" as paid.`
    );
  }

  return prisma.fundPayout.update({
    where: { id },
    data: { status: "paid", paidDate: paidDate ?? new Date() },
    include: PAYOUT_INCLUDE,
  });
}
