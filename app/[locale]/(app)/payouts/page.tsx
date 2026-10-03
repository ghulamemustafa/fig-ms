import { useTranslations } from "next-intl";
import { HandCoins, ShieldCheck, Landmark, ClipboardList, History } from "lucide-react";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  countPayouts,
  getPayoutsSummary,
  listPayouts,
  type ListPayoutsFilters,
} from "@/lib/payouts";
import { pageCountOf, resolvePage, resolvePageSize } from "@/lib/pagination";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayoutsToolbar } from "@/components/payouts/payouts-toolbar";
import { PayoutsList, type PayoutItem } from "@/components/payouts/payouts-list";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  const role = session?.user?.role;
  const userId = session?.user?.id;

  const canRequest = hasRole(role, ["treasurer", "admin"]);
  const canVp = hasRole(role, ["vp", "admin"]);
  const canPresident = hasRole(role, ["president", "admin"]);
  const canManage = hasRole(role, ["treasurer", "admin"]);

  const pageSize = resolvePageSize(sp.pageSize);
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(new Date(sp.to).getTime() + 86_400_000) : undefined;

  const filters: ListPayoutsFilters = {
    status: sp.status && sp.status !== "all" ? sp.status : undefined,
    payoutType: sp.type && sp.type !== "all" ? sp.type : undefined,
    search: sp.search?.trim() || undefined,
    from,
    to,
  };

  const [
    vpPendingCount,
    presPendingCount,
    myRequestsCount,
    total,
    summary,
  ] = await Promise.all([
    canVp ? prisma.fundPayout.count({ where: { status: "requested" } }) : 0,
    canPresident ? prisma.fundPayout.count({ where: { status: "vp_approved" } }) : 0,
    canRequest && userId ? prisma.fundPayout.count({ where: { requestedById: userId } }) : 0,
    countPayouts(filters),
    getPayoutsSummary(filters),
  ]);

  const page = resolvePage(sp.page, pageCountOf(total, pageSize));
  const rawPayouts = await listPayouts({ ...filters, page, pageSize });

  const payouts: PayoutItem[] = rawPayouts.map((p) => ({
    id: p.id,
    payoutType: p.payoutType,
    amount: String(p.amount),
    status: p.status,
    autoApproved: p.autoApproved,
    reason: p.reason,
    vpRejectReason: p.vpRejectReason,
    presRejectReason: p.presRejectReason,
    createdAt: p.createdAt.toISOString(),
    paidDate: p.paidDate ? p.paidDate.toISOString() : null,
    member: {
      id: p.member.id,
      name: p.member.name,
      serialNo: p.member.serialNo,
      cnic: p.member.cnic,
    },
    requestedBy: p.requestedBy,
    vpDecisionBy: p.vpDecisionBy,
    presDecisionBy: p.presDecisionBy,
  }));

  return (
    <PayoutsPageContent
      canRequest={canRequest}
      canVp={canVp}
      canPresident={canPresident}
      canManage={canManage}
      vpPendingCount={vpPendingCount}
      presPendingCount={presPendingCount}
      myRequestsCount={myRequestsCount}
      payouts={payouts}
      total={total}
      page={page}
      pageSize={pageSize}
      summary={summary}
    />
  );
}

function PayoutsPageContent({
  canRequest,
  canVp,
  canPresident,
  canManage,
  vpPendingCount,
  presPendingCount,
  myRequestsCount,
  payouts,
  total,
  page,
  pageSize,
  summary,
}: {
  canRequest: boolean;
  canVp: boolean;
  canPresident: boolean;
  canManage: boolean;
  vpPendingCount: number;
  presPendingCount: number;
  myRequestsCount: number;
  payouts: PayoutItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: Awaited<ReturnType<typeof getPayoutsSummary>>;
}) {
  const t = useTranslations("payoutsPage");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {canRequest && (
          <Link href="/payouts/request">
            <Card className="h-full transition-colors hover:bg-accent/60">
              <CardContent className="flex items-start gap-3 p-5">
                <HandCoins className="size-7 shrink-0 text-primary" />
                <div className="space-y-1">
                  <CardTitle className="text-base">{t("requestTitle")}</CardTitle>
                  <CardDescription className="text-xs">{t("requestDescription")}</CardDescription>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {canVp && (
          <Link href="/payouts/vp-queue">
            <Card className="h-full transition-colors hover:bg-accent/60">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="size-7 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <CardTitle className="text-base">{t("vpQueueTitle")}</CardTitle>
                    <CardDescription className="text-xs">{t("vpQueueDescription")}</CardDescription>
                  </div>
                </div>
                {vpPendingCount > 0 && (
                  <Badge variant="secondary" className="font-mono">
                    {vpPendingCount}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canPresident && (
          <Link href="/payouts/president-queue">
            <Card className="h-full transition-colors hover:bg-accent/60">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="flex items-start gap-3">
                  <Landmark className="size-7 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <CardTitle className="text-base">{t("presidentQueueTitle")}</CardTitle>
                    <CardDescription className="text-xs">{t("presidentQueueDescription")}</CardDescription>
                  </div>
                </div>
                {presPendingCount > 0 && (
                  <Badge variant="secondary" className="font-mono">
                    {presPendingCount}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canRequest && (
          <Link href="/payouts/my-requests">
            <Card className="h-full transition-colors hover:bg-accent/60">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="flex items-start gap-3">
                  <ClipboardList className="size-7 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <CardTitle className="text-base">{t("myRequestsTitle")}</CardTitle>
                    <CardDescription className="text-xs">{t("myRequestsDescription")}</CardDescription>
                  </div>
                </div>
                {myRequestsCount > 0 && (
                  <Badge variant="outline" className="font-mono">
                    {myRequestsCount}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        <Link href="/payouts/history">
          <Card className="h-full transition-colors hover:bg-accent/60">
            <CardContent className="flex items-start gap-3 p-5">
              <History className="size-7 shrink-0 text-primary" />
              <div className="space-y-1">
                <CardTitle className="text-base">{t("historyTitle")}</CardTitle>
                <CardDescription className="text-xs">{t("historyDescription")}</CardDescription>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{t("allPayouts")}</h2>
        </div>

        <PayoutsToolbar />

        <PayoutsList
          payouts={payouts}
          total={total}
          page={page}
          pageSize={pageSize}
          summary={summary}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
