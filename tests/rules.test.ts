import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  consecutiveUnpaidMonths,
  expectedFee,
  isFundEligible,
  isPastDue,
} from "@/lib/rules";

/**
 * These are integration tests: they run against the real dev Postgres
 * (docker compose up -d) and read the actual seeded members/payments from
 * `prisma/seed.ts`, rather than mocked fixtures — per the scenarios already
 * designed into that seed data. `REF_NOW` matches the fixed reference "today"
 * the seed data was authored against (see the comment at the top of seed.ts);
 * using the real clock here would make these tests drift once real time
 * passes 2026.
 */
const REF_NOW = new Date(Date.UTC(2026, 8, 26)); // 2026-09-26

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function getMemberByCnic(cnic: string) {
  const member = await prisma.member.findUniqueOrThrow({ where: { cnic } });
  return member;
}

async function getPaymentsFor(memberId: string) {
  return prisma.payment.findMany({ where: { memberId } });
}

let aliRaza: Awaited<ReturnType<typeof getMemberByCnic>>; // new member
let yaqoob: Awaited<ReturnType<typeof getMemberByCnic>>; // long-standing, paid up
let nasreen: Awaited<ReturnType<typeof getMemberByCnic>>; // 2 consecutive unpaid
let karim: Awaited<ReturnType<typeof getMemberByCnic>>; // 3 consecutive unpaid
let saleem: Awaited<ReturnType<typeof getMemberByCnic>>; // rejoined
let bilal: Awaited<ReturnType<typeof getMemberByCnic>>; // succession successor

beforeAll(async () => {
  [aliRaza, yaqoob, nasreen, karim, saleem, bilal] = await Promise.all([
    getMemberByCnic("35201-1111111-1"),
    getMemberByCnic("35201-2222222-2"),
    getMemberByCnic("35201-3333333-3"),
    getMemberByCnic("35201-4444444-4"),
    getMemberByCnic("35201-5555555-5"),
    getMemberByCnic("35201-7777777-7"),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("isPastDue", () => {
  it("is false on the 15th itself (grace period)", () => {
    expect(isPastDue(utcDate(2026, 9, 15), utcDate(2026, 9, 15))).toBe(false);
  });

  it("is false before the 15th", () => {
    expect(isPastDue(utcDate(2026, 9, 15), utcDate(2026, 9, 10))).toBe(false);
  });

  it("is true after the 15th", () => {
    expect(isPastDue(utcDate(2026, 9, 15), utcDate(2026, 9, 26))).toBe(true);
  });
});

describe("expectedFee", () => {
  it("charges the 2x new-member fee within the first 3 months (month 0)", async () => {
    // Ali Raza joined 2026-08-05; August is month 0 since join.
    await expect(expectedFee(aliRaza, utcDate(2026, 8, 1))).resolves.toBe(1000);
  });

  it("still charges 2x in month 1 since join", async () => {
    await expect(expectedFee(aliRaza, utcDate(2026, 9, 1))).resolves.toBe(1000);
  });

  it("drops to the normal fee exactly at the 3-month boundary", async () => {
    // Month 2 (October) is still inside the window; month 3 (November) is not.
    await expect(expectedFee(aliRaza, utcDate(2026, 10, 1))).resolves.toBe(1000);
    await expect(expectedFee(aliRaza, utcDate(2026, 11, 1))).resolves.toBe(500);
  });

  it("charges the normal fee for a member long past their first 3 months", async () => {
    await expect(expectedFee(yaqoob, utcDate(2026, 9, 1))).resolves.toBe(500);
  });

  it("does not re-trigger the 2x fee for a rejoined member, even in month 0 of their reset currentJoinDate", async () => {
    // Saleem's currentJoinDate resets to 2025-06-01 on rejoin; a literal
    // reading of the pseudocode would charge 2x here, but the spec's rejoin
    // rule explicitly forbids that (arrears only, no 2x re-trigger).
    await expect(expectedFee(saleem, utcDate(2025, 6, 1))).resolves.toBe(500);
  });

  it("does not charge the succession successor 2x, even in month 0 of their reset currentJoinDate", async () => {
    // Bilal's currentJoinDate resets to 2026-05-20 on taking over the
    // membership; per the confirmed decision, succession is treated like a
    // rejoin for fee purposes.
    await expect(expectedFee(bilal, utcDate(2026, 6, 1))).resolves.toBe(500);
  });
});

describe("isFundEligible", () => {
  it("is eligible for a succession successor immediately (inherited originalJoinDate)", async () => {
    // Bilal inherits Abdul Hameed's originalJoinDate (2010-05-01), so he's
    // already far past the 3-month wait despite having just taken over.
    await expect(isFundEligible(bilal, REF_NOW)).resolves.toBe(true);
  });

  it("is not eligible exactly at the 3-month boundary (must be MORE than 3 months)", async () => {
    const atBoundary = { originalJoinDate: utcDate(2026, 6, 26), status: "active" };
    await expect(isFundEligible(atBoundary, REF_NOW)).resolves.toBe(false);
  });

  it("is eligible just past the 3-month boundary", async () => {
    const pastBoundary = { originalJoinDate: utcDate(2026, 5, 26), status: "active" };
    await expect(isFundEligible(pastBoundary, REF_NOW)).resolves.toBe(true);
  });

  it("is not eligible for a removed member regardless of tenure", async () => {
    const removed = { originalJoinDate: utcDate(2010, 1, 1), status: "removed" };
    await expect(isFundEligible(removed, REF_NOW)).resolves.toBe(false);
  });
});

describe("consecutiveUnpaidMonths", () => {
  it("flags exactly 3 consecutive unpaid months", async () => {
    const payments = await getPaymentsFor(karim.id);
    expect(consecutiveUnpaidMonths(karim, payments, REF_NOW)).toBe(3);
  });

  it("counts 2 consecutive unpaid months for a member behind by less", async () => {
    const payments = await getPaymentsFor(nasreen.id);
    expect(consecutiveUnpaidMonths(nasreen, payments, REF_NOW)).toBe(2);
  });

  it("returns 0 for a member fully paid up through the current month", async () => {
    const payments = await getPaymentsFor(yaqoob.id);
    expect(consecutiveUnpaidMonths(yaqoob, payments, REF_NOW)).toBe(0);
  });
});
