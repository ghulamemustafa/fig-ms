import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { requestPayoutSchema } from "@/lib/schemas/payout";
import { listPayouts, PayoutError, requestPayout } from "@/lib/payouts";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const payouts = await listPayouts({
    status: searchParams.get("status") ?? undefined,
    memberId: searchParams.get("memberId") ?? undefined,
    requestedById: searchParams.get("requestedById") ?? undefined,
  });

  return NextResponse.json({ payouts });
}

export async function POST(request: Request) {
  let requestedById: string;
  try {
    const session = await requireRole(["treasurer", "admin"]);
    requestedById = session.user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = requestPayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const payout = await requestPayout(parsed.data, requestedById);
    return NextResponse.json({ payout }, { status: 201 });
  } catch (error) {
    if (error instanceof PayoutError) {
      return NextResponse.json(
        { error: error.code, message: error.message, detail: error.detail },
        { status: error.code === "NOT_FOUND" ? 404 : 409 }
      );
    }
    throw error;
  }
}
