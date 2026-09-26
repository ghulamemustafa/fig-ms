"use client";

import type { ReactNode } from "react";

import type { Role } from "@/lib/rbac";
import { useHasRole } from "@/hooks/use-role";

/** Hides `children` (client-side) unless the current user's role is in `allow`. */
export function RoleGate({
  allow,
  children,
  fallback = null,
}: {
  allow: readonly Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = useHasRole(allow);
  return <>{allowed ? children : fallback}</>;
}
