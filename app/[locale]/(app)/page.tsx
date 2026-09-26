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

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  const format = useFormatter();
  return (
    <div>
      <p className={`text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-destructive" : ""}`}>
        {format.number(value)}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
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
  const approvalsFirst = role === "vp" || role === "president";
  const { collection, members, defaulters, fund } = summary;
  const progress =
    collection.expected > 0
      ? Math.min(100, Math.round((collection.collected / collection.expected) * 100))
      : 0;

  const pendingCard = (isVp || isPresident) && (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {canCollect && (
          <Button
            size="lg"
            className="h-14 justify-start gap-3 text-base"
            render={
              <Link href="/payments/collect">
                <HandCoins className="size-5" />
                {t("quickCollect")}
              </Link>
            }
          />
        )}
        <Button
          size="lg"
          variant={canCollect ? "outline" : "default"}
          className="h-14 justify-start gap-3 text-base"
          render={
            <Link href="/payments/defaulters">
              <AlertTriangle className="size-5" />
              {t("quickDefaulters")}
              {defaulters.threePlus > 0 && (
                <Badge variant="destructive" className="ms-auto">
                  {defaulters.threePlus}
                </Badge>
              )}
            </Link>
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {approvalsFirst && pendingCard}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("collection.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t("collection.collected")} value={collection.collected} />
              <Stat label={t("collection.expected")} value={collection.expected} />
              <Stat label={t("collection.outstanding")} value={collection.outstanding} tone={collection.outstanding > 0 ? "warn" : undefined} />
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("defaulters.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t("defaulters.one")} value={defaulters.one} />
              <Stat label={t("defaulters.two")} value={defaulters.two} />
              <Stat label={t("defaulters.threePlus")} value={defaulters.threePlus} tone={defaulters.threePlus > 0 ? "warn" : undefined} />
            </div>
            <Link href="/payments/defaulters" className="inline-flex items-center gap-1 text-sm underline">
              {t("defaulters.viewAll")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("members.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("members.active")} value={members.active} />
            <Stat label={t("members.removed")} value={members.removed} />
            <Stat label={t("members.deceased")} value={members.deceased} />
            <Stat label={t("members.newThisMonth")} value={members.newThisMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("fund.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat label={t("fund.balance")} value={fund.balance} tone={fund.balance < 0 ? "warn" : undefined} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {(
                [
                  ["payments", fund.paymentsTotal],
                  ["otherIncome", fund.otherIncomeTotal],
                  ["donations", fund.donationsTotal],
                  ["expenses", fund.expensesTotal === 0 ? 0 : -fund.expensesTotal],
                  ["paidPayouts", fund.paidPayoutsTotal === 0 ? 0 : -fund.paidPayoutsTotal],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{t(`fund.${key}`)}</dt>
                  <dd className="text-end tabular-nums">{format.number(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {!approvalsFirst && pendingCard}

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("trend.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={summary.trend} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("recentPayouts.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.recentPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("recentPayouts.empty")}</p>
            ) : (
              summary.recentPayouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/members/${p.memberId}`} className="truncate font-medium underline">
                      {p.memberName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {tType(p.payoutType as "funeral" | "widow" | "other")} ·{" "}
                      <span className="tabular-nums">{format.number(p.amount)}</span>
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
                </div>
              ))
            )}
            <Link href="/payouts" className="inline-block text-sm underline">
              {t("recentPayouts.viewAll")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
