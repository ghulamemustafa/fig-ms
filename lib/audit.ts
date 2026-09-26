import "server-only";

import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Audit logging. Every mutation in lib/*.ts calls one of these with the same
 * client it uses for the mutation itself (the transaction client when there is
 * one), so the audit row commits or rolls back atomically with the change.
 * `changedBy` is a required argument on every audited mutation function, so a
 * new mutation can't be written without deciding who the actor is.
 */
type Db = Pick<PrismaClient, "auditLog">;

export type AuditAction = "create" | "update" | "delete";

export type AuditEntityType =
  | "Member"
  | "Dependent"
  | "Payment"
  | "FundPayout"
  | "OtherIncome"
  | "Donation"
  | "Expense"
  | "Setting";

export type AuditEntry = {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changedBy: string;
  changes: unknown;
  memberId?: string | null;
};

/** JSON-safe copy (Decimal -> string, Date -> ISO string). */
export function toJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/** Only the fields whose value differs, as { field: { from, to } }. */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = toJson(before[key] ?? null);
    const to = toJson(after[key] ?? null);
    if (JSON.stringify(from) !== JSON.stringify(to)) out[key] = { from, to };
  }
  return out;
}

function row(e: AuditEntry) {
  return {
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    changedBy: e.changedBy,
    changes: toJson(e.changes) as object,
    memberId: e.memberId ?? null,
  };
}

export async function logAudit(db: Db, entry: AuditEntry) {
  await db.auditLog.create({ data: row(entry) });
}

/** One INSERT for many rows — used on hot paths (e.g. multi-month payments). */
export async function logAuditMany(db: Db, entries: AuditEntry[]) {
  if (entries.length === 0) return;
  await db.auditLog.createMany({ data: entries.map(row) });
}

/** Full snapshot of a newly created record. */
export function auditCreate(
  db: Db,
  args: {
    entityType: AuditEntityType;
    record: { id: string } & Record<string, unknown>;
    changedBy: string;
    memberId?: string | null;
  }
) {
  return logAudit(db, {
    entityType: args.entityType,
    entityId: args.record.id,
    action: "create",
    changedBy: args.changedBy,
    changes: args.record,
    memberId: args.memberId,
  });
}

/** Before/after of changed fields. Skips the write if nothing changed and no extra context given. */
export async function auditUpdate(
  db: Db,
  args: {
    entityType: AuditEntityType;
    before: { id: string } & Record<string, unknown>;
    after: Record<string, unknown>;
    changedBy: string;
    memberId?: string | null;
    action?: AuditAction;
    /** Extra context merged into `changes` (e.g. a decision reason). */
    extra?: Record<string, unknown>;
  }
) {
  const changed = diff(args.before, args.after);
  if (Object.keys(changed).length === 0 && !args.extra) return;
  await logAudit(db, {
    entityType: args.entityType,
    entityId: args.before.id,
    action: args.action ?? "update",
    changedBy: args.changedBy,
    changes: { ...changed, ...(args.extra ? { _context: args.extra } : {}) },
    memberId: args.memberId,
  });
}
