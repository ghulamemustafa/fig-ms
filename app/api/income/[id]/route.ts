import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole } from "@/lib/auth-guards";
import { incomeEntrySchema } from "@/lib/schemas/ledger";
import { softDeleteIncome, updateIncome } from "@/lib/ledgers";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireRole(["treasurer", "data_entry", "admin"]);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = incomeEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const entry = await updateIncome(id, parsed.data);
  return NextResponse.json({ entry });
}

/** Soft delete only — admin only, per the "never hard-delete" principle. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requireRole(["admin"]);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  await softDeleteIncome(id);
  return NextResponse.json({ ok: true });
}
