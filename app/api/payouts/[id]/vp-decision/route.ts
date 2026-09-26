import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole } from "@/lib/auth-guards";
import { payoutDecisionSchema } from "@/lib/schemas/payout";
import { PayoutError, vpDecision } from "@/lib/payouts";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  let actorId: string;
  try {
    const session = await requireRole(["vp", "admin"]);
    actorId = session.user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = payoutDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const payout = await vpDecision(id, parsed.data.decision, parsed.data.reason, actorId);
    return NextResponse.json({ payout });
  } catch (error) {
    if (error instanceof PayoutError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 409 }
      );
    }
    throw error;
  }
}
