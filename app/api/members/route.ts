import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { createMemberSchema } from "@/lib/schemas/member";
import { createMember, DuplicateFieldError, listMembers, type MemberStatus } from "@/lib/members";

const STATUSES: readonly MemberStatus[] = ["active", "removed", "deceased"];

/**
 * Both GET consumers are typeaheads, so an uncapped list is never useful here —
 * and `listMembers` runs an eligibility check per row. Cap by default.
 */
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  try {
    await requireSession(); // any authenticated role can read
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = STATUSES.includes(statusParam as MemberStatus)
    ? (statusParam as MemberStatus)
    : undefined;
  // ?q= is the global-search param; ?search= is kept for the Members list page.
  const search = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim() || undefined;
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : MAX_LIMIT;

  const members = await listMembers({ status, search, limit });
  return NextResponse.json({ members });
}

export async function POST(request: Request) {
  let actorId: string;
  try {
    actorId = (await requireRole(["admin", "data_entry", "treasurer"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const member = await createMember(parsed.data, actorId);
    return NextResponse.json({ member }, { status: 201 });
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
