import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { recordPaymentsSchema } from "@/lib/schemas/payment";
import { PaymentError, recordPayments } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId") ?? undefined;
  const month = searchParams.get("month") ?? undefined; // "YYYY-MM"

  let monthFilter: { gte: Date; lt: Date } | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split("-").map(Number);
    monthFilter = {
      gte: new Date(Date.UTC(year, m - 1, 1)),
      lt: new Date(Date.UTC(year, m, 1)),
    };
  }

  const payments = await prisma.payment.findMany({
    where: {
      ...(memberId ? { memberId } : {}),
      ...(monthFilter ? { monthCovered: monthFilter } : {}),
    },
    include: { member: { select: { name: true, serialNo: true } } },
    orderBy: { monthCovered: "desc" },
  });

  return NextResponse.json({ payments });
}

const PAYMENT_ERROR_STATUS: Record<PaymentError["code"], number> = {
  MEMBER_NOT_FOUND: 404,
  REACTIVATION_REQUIRED: 409,
  ALREADY_PAID: 409,
  MEMBER_DECEASED: 400,
};

export async function POST(request: Request) {
  let recordedById: string;
  try {
    const session = await requireRole(["treasurer", "data_entry"]);
    recordedById = session.user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = recordPaymentsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await recordPayments({
      memberId: parsed.data.memberId,
      months: parsed.data.months,
      recordedById,
      confirmReactivation: parsed.data.confirmReactivation,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: PAYMENT_ERROR_STATUS[error.code] }
      );
    }
    throw error;
  }
}
