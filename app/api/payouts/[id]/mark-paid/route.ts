import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole } from "@/lib/auth-guards";
import { markPaidSchema } from "@/lib/schemas/payout";
import { markPaid, PayoutError } from "@/lib/payouts";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  let actorId: string;
  try {
    actorId = (await requireRole(["treasurer", "admin"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = markPaidSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const payout = await markPaid(id, parsed.data.paidDate, actorId);
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
