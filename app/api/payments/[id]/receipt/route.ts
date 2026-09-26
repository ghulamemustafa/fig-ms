import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireSession } from "@/lib/auth-guards";
import { getReceiptNoForPayment } from "@/lib/receipts";

type RouteParams = { params: Promise<{ id: string }> };

/** Resolves a single payment to the receipt (transaction) it belongs to. */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const receiptNo = await getReceiptNoForPayment(id);
  if (!receiptNo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const target = new URL(`/api/receipts/${encodeURIComponent(receiptNo)}`, request.url);
  target.search = new URL(request.url).search;
  return NextResponse.redirect(target);
}
