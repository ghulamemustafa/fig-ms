import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireSession } from "@/lib/auth-guards";
import { getDashboardSummary } from "@/lib/dashboard";

export async function GET() {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const summary = await getDashboardSummary();
  return NextResponse.json({ summary });
}
