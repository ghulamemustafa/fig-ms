import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole } from "@/lib/auth-guards";
import { expenseEntrySchema } from "@/lib/schemas/ledger";
import { softDeleteExpense, updateExpense } from "@/lib/ledgers";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  let actorId: string;
  try {
    actorId = (await requireRole(["treasurer", "data_entry", "admin"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = expenseEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const entry = await updateExpense(id, parsed.data, actorId);
  return NextResponse.json({ entry });
}

/** Soft delete only — admin only, per the "never hard-delete" principle. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  let actorId: string;
  try {
    actorId = (await requireRole(["admin"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  await softDeleteExpense(id, actorId);
  return NextResponse.json({ ok: true });
}
