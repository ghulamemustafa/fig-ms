import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { removeMemberSchema, updateMemberSchema } from "@/lib/schemas/member";
import { DuplicateFieldError, getMemberById, removeMember, updateMember } from "@/lib/members";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const member = await getMemberById(id);
  if (!member) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ member });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let actorId: string;
  try {
    actorId = (await requireRole(["admin", "data_entry", "treasurer"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const member = await updateMember(id, parsed.data, actorId);
    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof DuplicateFieldError) {
      return NextResponse.json(
        { error: "DUPLICATE", field: error.field, message: error.message },
        { status: 409 }
      );
    }
    throw error;
  }
}

/** Soft "remove" — sets status = removed with a reason. Admin only. */
export async function DELETE(request: Request, { params }: RouteParams) {
  let actorId: string;
  try {
    actorId = (await requireRole(["admin"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = removeMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const member = await removeMember(id, parsed.data.reason, actorId);
  return NextResponse.json({ member });
}
