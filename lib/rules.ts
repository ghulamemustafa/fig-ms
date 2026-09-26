import { getSettingValueAsOf } from "@/lib/settings";

// --- Date helpers (all calendar-month arithmetic is done in UTC so a Date's
// local timezone never shifts which "month" it belongs to). ---

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonthsUTC(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

function dueDateForMonth(monthCovered: Date): Date {
  return new Date(
    Date.UTC(monthCovered.getUTCFullYear(), monthCovered.getUTCMonth(), 15)
  );
}

function dateOnlyUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

// --- Rules ---

export interface MemberJoinInfo {
  originalJoinDate: Date;
  currentJoinDate: Date;
}

export interface MemberEligibilityInfo {
  originalJoinDate: Date;
  status: string;
}

export interface PaymentMonthInfo {
  monthCovered: Date;
}

/**
 * Fee due for `monthCovered`, reading baseFee/newMemberMultiplier/newMemberMonths
 * as they were EFFECTIVE AS OF that month (not today's values) — so re-running
 * this for a past month after a fee change still gives the historically correct
 * amount.
 *
 * The spec's pseudocode applies the 2x new-member fee whenever
 * monthsSinceJoin(currentJoinDate) < newMemberMonths. Applied literally, that
 * would also re-charge 2x to rejoined members and succession successors, since
 * both reset currentJoinDate — but the spec's business rules explicitly forbid
 * that for rejoins, and step 2 confirmed successors get the same treatment.
 * The distinguishing signal already in the data: a genuinely new member has
 * originalJoinDate === currentJoinDate (both set once, at creation); a rejoin
 * or succession sets a fresh currentJoinDate while originalJoinDate stays
 * put (or is inherited). So the 2x window only ever applies to a genuinely
 * new join.
 */
export async function expectedFee(
  member: MemberJoinInfo,
  monthCovered: Date
): Promise<number> {
  const [baseFeeStr, multiplierStr, newMemberMonthsStr] = await Promise.all([
    getSettingValueAsOf("baseFee", monthCovered),
    getSettingValueAsOf("newMemberMultiplier", monthCovered),
    getSettingValueAsOf("newMemberMonths", monthCovered),
  ]);

  if (baseFeeStr == null || multiplierStr == null || newMemberMonthsStr == null) {
    throw new Error(
      `Required fee settings are not configured as of ${monthCovered.toISOString()}`
    );
  }

  const baseFee = Number(baseFeeStr);
  const multiplier = Number(multiplierStr);
  const newMemberMonths = Number(newMemberMonthsStr);

  const isGenuinelyNewJoin =
    member.originalJoinDate.getTime() === member.currentJoinDate.getTime();

  if (!isGenuinelyNewJoin) {
    return baseFee;
  }

  const monthsSinceJoin = monthsBetween(member.currentJoinDate, monthCovered);
  return monthsSinceJoin < newMemberMonths ? baseFee * multiplier : baseFee;
}

export interface FundEligibilityDetail {
  eligible: boolean;
  monthsActive: number;
  eligibilityMonths: number;
}

/**
 * Full detail behind the fund-eligibility check — used wherever a caller
 * needs to explain an ineligible result (e.g. blocking a payout request with
 * "active for only 2 months, needs more than 3"), not just the boolean.
 *
 * `asOf` defaults to the real current date for production use; tests pass a
 * fixed reference date so results don't drift as real time passes.
 */
export async function getFundEligibilityDetail(
  member: MemberEligibilityInfo,
  asOf: Date = new Date()
): Promise<FundEligibilityDetail> {
  const eligibilityMonthsStr = await getSettingValueAsOf("eligibilityMonths", asOf);
  if (eligibilityMonthsStr == null) {
    throw new Error(
      `eligibilityMonths is not configured as of ${asOf.toISOString()}`
    );
  }
  const eligibilityMonths = Number(eligibilityMonthsStr);

  const monthsActive = monthsBetween(member.originalJoinDate, asOf);
  const statusEligible = member.status === "active" || member.status === "deceased";

  return {
    eligible: statusEligible && monthsActive > eligibilityMonths,
    monthsActive,
    eligibilityMonths,
  };
}

/**
 * Whether the member (or their family, if deceased) can currently claim a
 * fund payout: active or deceased, and strictly more than `eligibilityMonths`
 * months into their originalJoinDate (which a succession successor inherits,
 * making them immediately eligible with no fresh wait).
 */
export async function isFundEligible(
  member: MemberEligibilityInfo,
  asOf: Date = new Date()
): Promise<boolean> {
  const detail = await getFundEligibilityDetail(member, asOf);
  return detail.eligible;
}

/**
 * Walks backward from the current month (or the previous month, if this
 * month's 15th hasn't passed yet — it isn't "missed" until then) counting
 * consecutive months with no Payment row, stopping at the first paid month
 * or at the member's currentJoinDate (they can't be unpaid for a month
 * before they joined).
 *
 * `asOf` defaults to the real current date; tests pass a fixed reference
 * date to match frozen seed-data scenarios.
 */
export function consecutiveUnpaidMonths(
  member: { currentJoinDate: Date },
  payments: PaymentMonthInfo[],
  asOf: Date = new Date()
): number {
  const paidMonths = new Set(
    payments.map((p) => startOfMonthUTC(p.monthCovered).getTime())
  );

  const joinMonth = startOfMonthUTC(member.currentJoinDate);
  let cursor = startOfMonthUTC(asOf);
  if (!isPastDue(dueDateForMonth(cursor), asOf)) {
    cursor = addMonthsUTC(cursor, -1);
  }

  let count = 0;
  while (cursor.getTime() >= joinMonth.getTime()) {
    if (paidMonths.has(cursor.getTime())) break;
    count += 1;
    cursor = addMonthsUTC(cursor, -1);
  }
  return count;
}

/**
 * True once `asOf` is strictly after the 15th of dueDate's month — the 15th
 * itself is still within the grace period, per the spec's due-date rule.
 */
export function isPastDue(dueDate: Date, asOf: Date = new Date()): boolean {
  return dateOnlyUTC(asOf).getTime() > dateOnlyUTC(dueDate).getTime();
}
