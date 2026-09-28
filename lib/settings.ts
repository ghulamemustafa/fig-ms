import "server-only";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
export { BOOLEAN_SETTING_KEYS } from "@/lib/setting-types";

export const SETTING_KEYS = [
  "baseFee",
  "newMemberMultiplier",
  "newMemberMonths",
  "eligibilityMonths",
  "removalMonths",
  "requirePayoutApproval",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];


/**
 * Whether new payout requests must go through the VP then President chain as of
 * `asOf`. Defaults to true when never configured — the safe, original behaviour.
 */
export async function isPayoutApprovalRequired(asOf: Date = new Date()): Promise<boolean> {
  const value = await getSettingValueAsOf("requirePayoutApproval", asOf);
  return value !== "false";
}

export type SettingRow = {
  id: string;
  key: string;
  value: string;
  effectiveFrom: Date;
};

/**
 * The value in effect for `key` as of `asOf` — the most recent row whose
 * effectiveFrom is on or before that date. Returns null if nothing was ever
 * configured for `key` at or before `asOf` (e.g. a date before the setting
 * existed at all).
 */
export async function getSettingValueAsOf(
  key: SettingKey,
  asOf: Date
): Promise<string | null> {
  const row = await prisma.setting.findFirst({
    where: { key, effectiveFrom: { lte: asOf } },
    orderBy: { effectiveFrom: "desc" },
  });
  return row?.value ?? null;
}

/** Full history for `key`, newest first. */
export async function getSettingHistory(key: SettingKey): Promise<SettingRow[]> {
  return prisma.setting.findMany({
    where: { key },
    orderBy: { effectiveFrom: "desc" },
  });
}

export type SettingWithHistory = {
  key: SettingKey;
  current: SettingRow | null;
  history: SettingRow[];
};

/** All five settings, each with its currently-effective row plus full history. */
export async function getAllSettingsWithHistory(
  asOf: Date = new Date()
): Promise<SettingWithHistory[]> {
  return Promise.all(
    SETTING_KEYS.map(async (key) => {
      const history = await getSettingHistory(key);
      const current =
        history.find((row) => row.effectiveFrom.getTime() <= asOf.getTime()) ??
        null;
      return { key, current, history };
    })
  );
}

/**
 * Insert a new versioned row for `key` — never overwrites existing rows, so
 * old values stay in history for as-of-date lookups (see getSettingValueAsOf).
 * Rejects a non-increasing effectiveFrom so history stays append-only forward
 * in time (out-of-order backdated corrections aren't supported by this API).
 */
export async function insertSettingVersion(
  key: SettingKey,
  value: string,
  effectiveFrom: Date,
  changedBy: string
): Promise<SettingRow> {
  // Currently-effective row as of now — the "old value" an admin is replacing.
  const latest = await prisma.setting.findFirst({
    where: { key },
    orderBy: { effectiveFrom: "desc" },
  });
  if (latest && effectiveFrom.getTime() <= latest.effectiveFrom.getTime()) {
    throw new Error(
      "effectiveFrom must be after the current effective date for this setting"
    );
  }
  return prisma.$transaction(async (tx) => {
    const row = await tx.setting.create({ data: { key, value, effectiveFrom } });
    await logAudit(tx, {
      entityType: "Setting",
      entityId: row.id,
      action: "create",
      changedBy,
      changes: {
        setting: key,
        value: { from: latest?.value ?? null, to: value },
        effectiveFrom: { from: latest?.effectiveFrom ?? null, to: effectiveFrom },
        record: row,
      },
    });
    return row;
  });
}
