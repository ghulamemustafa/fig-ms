import "server-only";

import { prisma } from "@/lib/prisma";
import type { AuditEntityType } from "@/lib/audit";

export const AUDIT_ENTITY_TYPES: readonly AuditEntityType[] = [
  "Member",
  "Dependent",
  "Payment",
  "FundPayout",
  "OtherIncome",
  "Donation",
  "Expense",
  "Setting",
];

export type AuditFilters = {
  entityType?: string;
  changedBy?: string;
  memberId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

export type AuditLogView = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changedBy: string;
  changedByName: string;
  changes: unknown;
  timestamp: Date;
  memberId: string | null;
  memberName: string | null;
  memberSerialNo: string | null;
};

export async function listAuditLogs(filters: AuditFilters): Promise<AuditLogView[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.changedBy ? { changedBy: filters.changedBy } : {}),
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.from || filters.to
        ? {
            timestamp: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lt: filters.to } : {}),
            },
          }
        : {}),
    },
    include: { member: { select: { name: true, serialNo: true } } },
    orderBy: { timestamp: "desc" },
    take: filters.limit ?? 100,
  });

  // changedBy is a plain id (no FK) — resolve display names in one query.
  const userIds = [...new Set(rows.map((r) => r.changedBy))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    action: r.action,
    changedBy: r.changedBy,
    changedByName: nameById.get(r.changedBy) ?? r.changedBy,
    changes: r.changes,
    timestamp: r.timestamp,
    memberId: r.memberId,
    memberName: r.member?.name ?? null,
    memberSerialNo: r.member?.serialNo ?? null,
  }));
}
