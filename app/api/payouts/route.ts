import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { requestPayoutSchema } from "@/lib/schemas/payout";
import { countPayouts, getPayoutsSummary, listPayouts, PayoutError, requestPayout } from "@/lib/payouts";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const payoutType = searchParams.get("payoutType") ?? searchParams.get("type") ?? undefined;
  const memberId = searchParams.get("memberId") ?? undefined;
  const requestedById = searchParams.get("requestedById") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(new Date(toStr).getTime() + 86_400_000) : undefined;

  const pageStr = searchParams.get("page");
  const pageSizeStr = searchParams.get("pageSize");
  const page = pageStr ? Number(pageStr) : undefined;
  const pageSize = pageSizeStr ? Number(pageSizeStr) : undefined;

  const filters = {
    status,
    payoutType,
    memberId,
    requestedById,
    search,
    from,
    to,
    page,
    pageSize,
  };

  const payouts = await listPayouts(filters);

  if (pageSize !== undefined || searchParams.get("includeMeta") === "true") {
    const [total, summary] = await Promise.all([
      countPayouts(filters),
      getPayoutsSummary(filters),
    ]);
    return NextResponse.json({ payouts, total, summary, page: page ?? 1, pageSize: pageSize ?? total });
  }

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
