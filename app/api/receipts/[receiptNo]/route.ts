import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireSession } from "@/lib/auth-guards";
import { getReceipt } from "@/lib/receipts";
import { renderReceiptPdf } from "@/lib/receipt-pdf";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ receiptNo: string }> };

/** Streams the receipt PDF, regenerated from the Payment rows each time. `?download=1` forces a download. */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { receiptNo } = await params;
  const receipt = await getReceipt(receiptNo);
  if (!receipt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const pdf = await renderReceiptPdf(receipt);
  const disposition = new URL(request.url).searchParams.get("download") ? "attachment" : "inline";

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="receipt-${receiptNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
