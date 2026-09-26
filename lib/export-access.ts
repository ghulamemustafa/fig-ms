import type { Role } from "@/lib/rbac";

export const EXPORT_ENTITIES = [
  "members",
  "payments",
  "payouts",
  "income",
  "donations",
  "expenses",
  "statement",
] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

/**
 * Who may export what. Single source of truth for the API route and the Reports
 * screen. Payouts and the period statement are also open to vp/president, who
 * already see payouts and the fund balance in the app (approval queues, dashboard).
 */
export const EXPORT_ROLES: Record<ExportEntity, readonly Role[]> = {
  members: ["admin", "treasurer"],
  payments: ["admin", "treasurer"],
  income: ["admin", "treasurer"],
  donations: ["admin", "treasurer"],
  expenses: ["admin", "treasurer"],
  payouts: ["admin", "treasurer", "vp", "president"],
  statement: ["admin", "treasurer", "vp", "president"],
};

export const REPORTS_ROLES: readonly Role[] = ["admin", "treasurer", "vp", "president"];
