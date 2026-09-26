# Family Welfare Committee Management System — Project Spec

## Overview

A web app to computerize the record-keeping of a family welfare committee (~200 members) that
currently uses paper and pen. Members pay a monthly fee; the committee pays out funds for
member deaths (funeral expense) and widow support, among other activities.

## Tech Stack

- **Framework**: Next.js (App Router, TypeScript) — frontend + API routes in one project
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod (shared schemas between forms and API routes)
- **UI**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts (for dashboard)
- **Auth**: Auth.js (NextAuth) or a simple custom session/JWT — role-based
- **Hosting target**: Vercel + a managed Postgres (Neon/Supabase/Railway)
- **i18n**: `next-intl` (or `next-i18next`) for English + Urdu, with Urdu rendered RTL

## Frontend Structure

### Device target: mobile + desktop (mobile-first)

Data entry (payments especially) will happen on phones as well as desktop, so build
mobile-first and treat desktop as an enhancement, not the default:

- Single-column, thumb-friendly forms on mobile (large tap targets, minimal typing —
  prefer pickers/autocomplete over free text where possible, e.g. member search-select
  instead of typing a full name).
- Bottom navigation bar on mobile (Dashboard / Members / Payments / Payouts / More);
  collapses into a left sidebar on desktop (`md:` breakpoint and up) using shadcn/ui's
  sidebar or a simple responsive layout — no separate mobile app, just responsive Next.js.
  pages.
- Tables (payment history, member lists) become stacked cards on narrow screens rather
  than horizontally-scrolling tables — this is the single biggest mobile-usability fix
  for this kind of app.
- Global search accessible from a persistent top bar on both layouts.
- Test every screen at a ~375px viewport width during development, not just desktop.

### Language: English + Urdu

- Use `next-intl` with two locale JSON dictionaries (`en.json`, `ur.json`) — every UI
  string (labels, buttons, table headers, validation messages) goes through the
  translation function, not hardcoded text, from the first screen built.
- Urdu renders **right-to-left**: set `dir="rtl"` on the `<html>` tag when the Urdu locale
  is active, and use Tailwind's logical properties (`ms-`/`me-`/`ps-`/`pe-` instead of
  `ml-`/`mr-`/`pl-`/`pr-`) so spacing/alignment flips correctly instead of looking broken.
- Data itself (member names, addresses, notes) is entered as-is by the user in whatever
  script they use — only UI chrome (labels, buttons, messages) needs translation, not
  member data.
- A simple locale switcher (EN/اردو) in the top bar, persisted per user (or per browser)
  so each committee member doesn't have to reselect it every visit.
- Numbers/dates: keep dates in a consistent format regardless of locale (avoid ambiguity
  in financial/legal records); Urdu numerals are optional — Western digits are commonly
  used even in Urdu UIs and are simpler to keep consistent in ledgers.
- Start i18n scaffolding in step 1 of the build order (below), not bolted on later —
  retrofitting translation keys across dozens of already-built components is much more
  tedious than writing them with `t('key')` from the start.

### Layout & key UI patterns

- **Shell**: top bar (logo/title, global search, locale switcher, user menu) + responsive
  nav (bottom bar on mobile, sidebar on desktop) + main content area.
- **Members**: list with status filter (active/removed/deceased) + search, card-based on
  mobile / table on desktop; detail page with tabs (Profile / Dependents / Payments /
  Payouts).
- **Payments — "collect payment" flow**: member autocomplete (by name/CNIC/serial) →
  outstanding month(s) shown automatically with amount pre-filled per the fee rule → one
  tap/click to record. This is likely the most-used screen day to day, so it deserves the
  most attention to mobile speed and simplicity.
- **Defaulters view**: list of members 1/2/3 consecutive months behind — second most-used
  screen, should be reachable in one tap from the dashboard.
- **Payouts**: role-filtered views — Treasurer sees "my requests," VP/President see
  "pending my approval" — same underlying data, filtered by role and status, with
  approve/reject (+ reason) actions.
- **Forms**: shadcn/ui form components + `react-hook-form` + Zod resolver, so client-side
  validation reuses the exact same Zod schemas as the API routes (one source of truth for
  validation, including bilingual error messages via `next-intl`).
- **Data fetching**: Next.js Server Components for read-heavy pages (lists, dashboard,
  reports); TanStack Query only where client-side interactivity is needed (payout
  approval queue with optimistic updates, live search-as-you-type). No global state
  library needed at this scale.
- **Visual style**: shadcn/ui defaults (clean, neutral) with one accent color choice;
  no heavy custom design work needed for an internal admin tool.

## Roles

- `admin` — full access, manages settings/users
- `treasurer` — records payments/income/expenses, requests fund payouts
- `vp` — first-level payout approver
- `president` — second-level payout approver
- `data_entry` — can record members/payments but not approve payouts or change settings

No member self-service portal for now (admin/committee-only tool).

## Core Business Rules

### Membership

- New member pays **2x the base fee for the first 3 months**, then the normal fee.
- A member must be active for **more than 3 months** to be eligible for fund payouts
  (funeral, widow, etc.).
- A member is **removed** after **3 consecutive unpaid months**.
- **Payment due date**: the 15th of the month being covered. A month counts as "missed"
  only once the 15th passes unpaid (grace period).
- **Full payment only** — no partial payments allowed. Payment status per month is binary:
  paid / unpaid.
- **Rejoining members** (previously removed, later rejoin): pay only the arrears
  (missed months), **no 2x fee re-trigger**. Track `currentJoinDate` separately from
  `originalJoinDate` for this case — `currentJoinDate` resets, `originalJoinDate` does not
  necessarily need to reset either (rejoining does not need to re-serve the 3-month
  eligibility wait — confirm exact interpretation with the committee if ambiguous, but the
  agreed behavior is: no 2x fee, pay arrears, resume normally).
- **Death of a member**: membership ends (`status = deceased`), and the member's family
  becomes eligible for the **funeral fund** payout. **Any adult family member** may take over
  the membership. The new member record **inherits the deceased's `originalJoinDate`**,
  making them immediately fund-eligible (no fresh 3-month wait). Link the two records via a
  `predecessor` / `succeededBy` relation so history is preserved.
- Removal/death never deletes historical records — always soft-status changes.

### Fees

- Base fee amount is **configurable** and can change over time. Each `Payment` record stores
  the **actual amount charged** at the time (locked), so historical payments are unaffected by
  later fee changes.
- Settings (fee amount, new-member multiplier, new-member period, eligibility wait period,
  removal threshold) are stored in a `Setting` table with effective-date tracking, not
  hardcoded.

### Fund Payouts

- Payout types: `funeral`, `widow`, `other` (extensible).
- **No cap** on number/amount of claims per member per year.
- **Single shared balance** for now (not split into separate per-fund pools) — reportable by
  category, but one pot of money.
- **Approval workflow** (sequential, two-step):
  1. Treasurer requests a payout.
  2. VP approves or rejects (with reason). **If VP rejects, the chain stops — terminal
     state, President does not get to override.**
  3. If VP approves, President approves or rejects (with reason).
  4. Once President approves, payout is marked `paid` (with paid date).
- Status values: `requested → vp_approved → president_approved → paid`, or terminal
  `vp_rejected` / `president_rejected` (each with a reason, visible to the Treasurer).

### Reminders

- **SMS only** (no WhatsApp for now — research a Pakistan-friendly SMS gateway/API provider
  during implementation).
- Send a nudge before the 15th (due date) and an escalation message after the 15th if unpaid.

### Other Features (agreed, in scope)

- **Receipts**: auto-generate a receipt (PDF or shareable text) on each payment.
- **Audit log**: every create/update/delete on Members, Payments, Payouts, Expenses, etc.
  logged with who did it, when, and what changed.
- **Configurable settings**: fee amount, new-member multiplier, new-member period,
  eligibility wait period, removal threshold — editable by admin, with effective-date
  history (don't overwrite/lose old values).
- **Data export**: CSV/Excel/PDF export for members, payments, and reports.
- **Automated backups**: daily database backup.
- **Document attachments**: deferred for a future phase — leave room in the data model
  (e.g., an `Attachment` table keyed to entity type + id) but do not build the upload UI yet.

## Data Model (Prisma schema — starting point)

```prisma
model Member {
  id               String   @id @default(cuid())
  serialNo         String   @unique
  name             String
  fatherName       String
  cnic             String   @unique
  mobile           String
  address          String
  maritalStatus    String
  occupation       String
  income           Decimal
  dob              DateTime
  originalJoinDate DateTime          // preserved across rejoin/inheritance
  currentJoinDate  DateTime          // resets on rejoin (not on inheritance)
  status           String   @default("active") // active | removed | deceased
  removedDate      DateTime?
  removedReason    String?
  succeededById    String?  @unique  // the member who inherited this membership after death
  succeededBy      Member?  @relation("Succession", fields: [succeededById], references: [id])
  predecessor      Member?  @relation("Succession")

  dependents  Dependent[]
  payments    Payment[]
  payouts     FundPayout[]
  auditLogs   AuditLog[]

  @@index([name])
}

model Dependent {
  id            String   @id @default(cuid())
  memberId      String
  member        Member   @relation(fields: [memberId], references: [id])
  name          String
  relation      String
  maritalStatus String
  dob           DateTime
  occupation    String
  notes         String?
}

model Payment {
  id             String   @id @default(cuid())
  memberId       String
  member         Member   @relation(fields: [memberId], references: [id])
  monthCovered   DateTime
  amount         Decimal          // locked at time of payment
  wasDoubleFee   Boolean  @default(false)
  paidDate       DateTime
  dueDate        DateTime         // 15th of monthCovered
  receiptNo      String   @unique
  recordedById   String
  recordedBy     User     @relation(fields: [recordedById], references: [id])

  @@unique([memberId, monthCovered])
}

model OtherIncome {
  id          String   @id @default(cuid())
  date        DateTime
  source      String
  amount      Decimal
  description String?
}

model Donation {
  id           String   @id @default(cuid())
  date         DateTime
  donorName    String
  donorContact String?
  amount       Decimal
  notes        String?
}

model Expense {
  id          String   @id @default(cuid())
  date        DateTime
  category    String
  amount      Decimal
  description String?
  approvedBy  String?
}

model FundPayout {
  id               String    @id @default(cuid())
  memberId         String
  member           Member    @relation(fields: [memberId], references: [id])
  payoutType       String    // funeral | widow | other
  amount           Decimal
  reason           String?
  status           String    @default("requested")
  // requested | vp_approved | vp_rejected | president_approved | president_rejected | paid
  requestedById    String
  vpDecisionById   String?
  vpDecisionAt     DateTime?
  vpRejectReason   String?
  presDecisionById String?
  presDecisionAt   DateTime?
  presRejectReason String?
  paidDate         DateTime?
}

model Setting {
  id            String @id @default(cuid())
  key           String @unique  // baseFee, newMemberMultiplier, newMemberMonths, eligibilityMonths, removalMonths
  value         String
  effectiveFrom DateTime
}

model User {
  id       String @id @default(cuid())
  name     String
  email    String @unique
  password String
  role     String // admin | treasurer | vp | president | data_entry
  payments Payment[]
}

model AuditLog {
  id         String   @id @default(cuid())
  entityType String   // Member | Payment | FundPayout | Expense ...
  entityId   String
  action     String   // create | update | delete
  changedBy  String
  changes    Json
  timestamp  DateTime @default(now())
  memberId   String?
  member     Member?  @relation(fields: [memberId], references: [id])
}
```

## Shared Business Logic (put in `lib/rules.ts`, used by both API and UI)

```ts
// Pseudocode outline — implement with real date-diffing logic

function expectedFee(member, monthCovered, baseFee, multiplier, newMemberMonths): number {
  const monthsSinceJoin = diffInMonths(member.currentJoinDate, monthCovered);
  return monthsSinceJoin < newMemberMonths ? baseFee * multiplier : baseFee;
}

function isFundEligible(member, eligibilityMonths): boolean {
  const monthsActive = diffInMonths(member.originalJoinDate, new Date());
  return (member.status === "active" || member.status === "deceased") && monthsActive > eligibilityMonths;
}

function consecutiveUnpaidMonths(member, payments): number {
  // walk backward month by month from current month (respecting the 15th due date)
  // until a paid month is found; return the count of consecutive unpaid months
}

function isPastDue(dueDate: Date): boolean {
  // true if today > 15th of the covered month
}
```

## API Routes (Next.js `app/api/`)

```
/api/members                    GET (search/list/filter), POST (create)
/api/members/[id]                GET, PATCH, DELETE (soft — sets status)
/api/members/[id]/dependents      GET, POST
/api/members/[id]/succeed         POST (record death + successor, inherits originalJoinDate)
/api/payments                    GET (filterable by member/month), POST
/api/income                       GET, POST
/api/donations                    GET, POST
/api/expenses                      GET, POST
/api/payouts                       GET, POST (request)
/api/payouts/[id]/vp-decision       POST (approve/reject + reason)
/api/payouts/[id]/president-decision POST (approve/reject + reason)
/api/payouts/[id]/mark-paid           POST
/api/settings                       GET, PATCH (admin only, versioned by effectiveFrom)
/api/dashboard/summary               GET (aggregates)
/api/reports/defaulters               GET (members with 1/2/3 consecutive unpaid months)
/api/export/[entity]                    GET (CSV/PDF export)
```

## Screens

1. **Member registration** — personal info + inline dependent management
2. **Member detail** — profile, payment history, dependents, fund-eligibility status,
   succession info (if deceased)
3. **Payments** — record monthly payment (amount auto-filled per rule), view history
4. **Fund Payouts** — request, VP approval queue, President approval queue, payout history
5. **Income / Donations / Expenses** — simple ledger entry + list screens
6. **Settings** — base fee, multiplier, periods/thresholds (admin only, with history)
7. **Dashboard** — active/removed/deceased counts, this month's collection vs. expected,
   defaulters list (1/2/3 months overdue, flagged for review before removal), fund balance,
   income/expense trend chart, recent payouts
8. **Search** — single search box across name, CNIC, serial no, mobile
9. **Reports/Export** — CSV/PDF export of members, payments, payouts, income/expense

## Suggested Build Order (for Claude Code, incremental)

1. Project setup: Next.js + TypeScript + Tailwind + shadcn/ui + Prisma + Postgres connection
   + `next-intl` scaffolding (en/ur dictionaries, locale switcher, RTL handling) + responsive
   app shell (bottom nav mobile / sidebar desktop)
2. Prisma schema + first migration + seed script (a few test members/users)
3. Auth + role-based access (admin/treasurer/vp/president/data_entry)
4. Settings module (fee, multiplier, periods, thresholds) — needed by everything else
5. Member + Dependent CRUD (including succession/death flow)
6. Payments module (fee calculation, due dates, payment recording)
7. Fund Payouts module (request + 2-step approval workflow)
8. Income / Donations / Expenses ledgers
9. Dashboard + charts
10. Search
11. Audit logging (retrofit into all mutating routes)
12. Receipts (PDF/text generation on payment)
13. SMS reminders (research + integrate a Pakistan-friendly SMS gateway)
14. Data export (CSV/PDF)
15. Automated backups (cron job / hosting provider feature)
16. (Future phase) Document attachments

## Notes for Implementation

- Never hard-delete Members, Payments, or Payouts — use status fields to preserve history.
- All monetary amounts should use `Decimal`, not `Float`, to avoid rounding issues.
- All business rule constants (fee, multiplier, periods) must be read from the `Setting`
  table, not hardcoded, so the committee can change policy without a code change.
- The monthly "flag for removal at 3 consecutive unpaid months" job should **flag for human
  review**, not auto-remove — a committee admin confirms before a member's status changes.
- Keep the approval-chain rejection reasons visible to the Treasurer so they can inform the
  requesting member or correct and resubmit if appropriate.
