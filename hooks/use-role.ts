"use client";

import { useSession } from "next-auth/react";
import type { Role } from "@/lib/rbac";
import { hasRole } from "@/lib/rbac";

/** Client-side: current user's role (or undefined while the session is loading / signed out). */
export function useRole(): Role | undefined {
  const { data: session } = useSession();
  return session?.user?.role;
}

/** Client-side: whether the current user's role is in `allowed`. */
export function useHasRole(allowed: readonly Role[]): boolean {
  const role = useRole();
  return hasRole(role, allowed);
}
