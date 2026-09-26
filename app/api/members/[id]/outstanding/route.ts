import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireSession } from "@/lib/auth-guards";
import { MAX_ADVANCE_MONTHS, getOutstandingMonths, getUpcomingMonths } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const member = await prisma.member.findUnique({
    where: { id },
    include: { payments: { select: { monthCovered: true } } },
  });
  if (!member) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const [outstanding, upcoming] = await Promise.all([
    getOutstandingMonths(member, member.payments),
    member.status === "deceased" ? Promise.resolve([]) : getUpcomingMonths(member, member.payments),
  ]);

  return NextResponse.json({
    member: {
      id: member.id,
      name: member.name,
      serialNo: member.serialNo,
      cnic: member.cnic,
      status: member.status,
      removedDate: member.removedDate,
      removedReason: member.removedReason,
    },
    outstanding,
    upcoming,
    maxAdvanceMonths: MAX_ADVANCE_MONTHS,
  });
}
