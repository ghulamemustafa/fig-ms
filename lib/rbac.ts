export const ROLES = [
  "admin",
  "treasurer",
  "vp",
  "president",
  "data_entry",
] as const;

export type Role = (typeof ROLES)[number];

export function hasRole(
  role: Role | undefined | null,
  allowed: readonly Role[]
): boolean {
  return !!role && allowed.includes(role);
}
