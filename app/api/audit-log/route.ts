import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole } from "@/lib/auth-guards";
import { listAuditLogs } from "@/lib/audit-queries";

export async function GET(request: Request) {
  try {
    await requireRole(["admin"]);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const p = new URL(request.url).searchParams;
  const from = p.get("from");
  const to = p.get("to");
  const entries = await listAuditLogs({
    entityType: p.get("entityType") ?? undefined,
    changedBy: p.get("changedBy") ?? undefined,
    memberId: p.get("memberId") ?? undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(new Date(to).getTime() + 86_400_000) : undefined,
  });
  return NextResponse.json({ entries });
}
