import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole } from "@/lib/auth-guards";
import { succeedMemberSchema } from "@/lib/schemas/member";
import { succeedMember } from "@/lib/members";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  let actorId: string;
  try {
    actorId = (await requireRole(["admin", "data_entry"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = succeedMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const successor = await succeedMember(id, parsed.data, actorId);
    return NextResponse.json({ successor }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Succession failed" },
      { status: 409 }
    );
  }
}
