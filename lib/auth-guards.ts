import "server-only";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { hasRole, type Role } from "@/lib/rbac";

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

/** Server Components / Server Actions / Route Handlers: get the current session, if any. */
export async function getSession() {
  return auth();
}

/** Throws AuthError("UNAUTHENTICATED") if there's no logged-in user. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("UNAUTHENTICATED");
  }
  return session;
}

/**
 * Throws AuthError("UNAUTHENTICATED") / ("FORBIDDEN") unless the current user
 * is logged in and has one of the allowed roles. Use in Route Handlers:
 *
 *   try {
 *     const session = await requireRole(["admin"]);
 *     ...
 *   } catch (e) {
 *     if (e instanceof AuthError) return authErrorResponse(e);
 *     throw e;
 *   }
 */
export async function requireRole(allowed: readonly Role[]) {
  const session = await requireSession();
  if (!hasRole(session.user.role, allowed)) {
    throw new AuthError("FORBIDDEN");
  }
  return session;
}

/** Convert a caught AuthError into the right HTTP response for a Route Handler. */
export function authErrorResponse(error: AuthError) {
  return NextResponse.json(
    { error: error.code },
    { status: error.code === "UNAUTHENTICATED" ? 401 : 403 }
  );
}
