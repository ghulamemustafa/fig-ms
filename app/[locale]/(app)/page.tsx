import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, HandCoins, ShieldCheck } from "lucide-react";

import { getSession } from "@/lib/auth-guards";
import { hasRole, type Role } from "@/lib/rbac";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/dashboard/trend-chart";

export default async function DashboardPage() {
  const [session, summary] = await Promise.all([getSession(), getDashboardSummary()]);
  return <DashboardContent summary={summary} role={session?.user?.role} />;
}

function Stat({
  label,
  value,
  tone,
  size = "md",
}: {
  label: string;
  value: number;
  tone?: "warn";
  size?: "md" | "xl";
}) {
  const format = useFormatter();
  return (
    <div className="min-w-0">
      <p
        className={`font-mono font-medium tracking-tight tabular-nums ${
          size === "xl" ? "text-4xl md:text-5xl" : "text-2xl"
        } ${tone === "warn" ? "text-destructive" : ""}`}
      >
        {format.number(value)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardContent({
  summary,
  role,
}: {
  summary: DashboardSummary;
  role: Role | undefined;
}) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("payoutStatus");
  const tType = useTranslations("payoutType");
  const format = useFormatter();

  const canCollect = hasRole(role, ["treasurer", "data_entry"]);
  const isVp = hasRole(role, ["vp", "admin"]);
  const isPresident = hasRole(role, ["president", "admin"]);
  const showPendingApprovals = summary.requirePayoutApproval && (isVp || isPresident);
  const approvalsFirst = showPendingApprovals && (role === "vp" || role === "president");
  const { collection, members, defaulters, fund } = summary;
  const progress =
    collection.expected > 0
      ? Math.min(100, Math.round((collection.collected / collection.expected) * 100))
      : 0;

  const pendingCard = showPendingApprovals && (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheck className="size-4" />
          {t("pending.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-6">
        {isVp && (
          <Link href="/payouts/vp-queue" className="flex items-center gap-3">
            <Stat label={t("pending.vp")} value={summary.pendingApprovals.vp} tone={summary.pendingApprovals.vp > 0 ? "warn" : undefined} />
            <ArrowRight className="size-4 text-muted-foreground rtl:rotate-180" />
          </Link>
        )}
        {isPresident && (
          <Link href="/payouts/president-queue" className="flex items-center gap-3">
            <Stat label={t("pending.president")} value={summary.pendingApprovals.president} tone={summary.pendingApprovals.president > 0 ? "warn" : undefined} />
            <ArrowRight className="size-4 text-muted-foreground rtl:rotate-180" />
          </Link>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {canCollect && (
            <Button
              size="lg"
              className="h-11 gap-2 px-4 text-sm"
              render={
                <Link href="/payments/collect">
                  <HandCoins className="size-4" />
                  {t("quickCollect")}
                </Link>
              }
            />
          )}
          <Button
            size="lg"
            variant={canCollect ? "outline" : "default"}
            className="h-11 gap-2 px-4 text-sm"
            render={
              <Link href="/payments/defaulters">
                <AlertTriangle className="size-4" />
                {t("quickDefaulters")}
                {defaulters.threePlus > 0 && (
                  <Badge
                    variant="destructive"
                    className={canCollect ? "ms-1" : "ms-1 bg-primary-foreground/20 text-primary-foreground"}
                  >
                    {defaulters.threePlus}
                  </Badge>
                )}
              </Link>
            }
          />
        </div>
      </div>

      {approvalsFirst && pendingCard}

      {/* Asymmetric: the fund balance leads, collection and defaulters sit beside it. */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="bg-gradient-to-br from-card to-accent/40">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("fund.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Stat label={t("fund.balance")} value={fund.balance} tone={fund.balance < 0 ? "warn" : undefined} size="xl" />
            <dl className="divide-y text-sm">
              {(
                [
                  ["payments", fund.paymentsTotal],
                  ["otherIncome", fund.otherIncomeTotal],
                  ["donations", fund.donationsTotal],
                  ["expenses", fund.expensesTotal === 0 ? 0 : -fund.expensesTotal],
                  ["paidPayouts", fund.paidPayoutsTotal === 0 ? 0 : -fund.paidPayoutsTotal],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <dt className="text-muted-foreground">{t(`fund.${key}`)}</dt>
                  <dd className="font-mono tabular-nums">{format.number(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("collection.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label={t("collection.collected")} value={collection.collected} />
                <Stat label={t("collection.expected")} value={collection.expected} />
                <Stat label={t("collection.outstanding")} value={collection.outstanding} tone={collection.outstanding > 0 ? "warn" : undefined} />
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("defaulters.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label={t("defaulters.one")} value={defaulters.one} />
                <Stat label={t("defaulters.two")} value={defaulters.two} />
                <Stat label={t("defaulters.threePlus")} value={defaulters.threePlus} tone={defaulters.threePlus > 0 ? "warn" : undefined} />
              </div>
              <Link href="/payments/defaulters" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {t("defaulters.viewAll")}
                <ArrowRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:rtl:divide-x-reverse">
          <div className="sm:pe-4">
            <Stat label={t("members.active")} value={members.active} />
          </div>
          <div className="sm:px-4">
            <Stat label={t("members.removed")} value={members.removed} />
          </div>
          <div className="sm:px-4">
            <Stat label={t("members.deceased")} value={members.deceased} />
          </div>
          <div className="sm:ps-4">
            <Stat label={t("members.newThisMonth")} value={members.newThisMonth} />
          </div>
        </CardContent>
      </Card>

      {!approvalsFirst && pendingCard}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("trend.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={summary.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("recentPayouts.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentPayouts.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {t("recentPayouts.empty")}
              </p>
            ) : (
              <ul className="divide-y">
                {summary.recentPayouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/members/${p.memberId}`} className="block truncate font-medium hover:underline">
                        {p.memberName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {tType(p.payoutType as "funeral" | "widow" | "other")} ·{" "}
                        <span className="font-mono tabular-nums">{format.number(p.amount)}</span>
                      </p>
                    </div>
                    <Badge
                      variant={
                        p.status === "paid"
                          ? "default"
                          : p.status.includes("rejected")
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {tStatus(p.status as "requested" | "vp_approved" | "vp_rejected" | "president_approved" | "president_rejected" | "paid")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/payouts/history" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {t("recentPayouts.viewAll")}
              <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
