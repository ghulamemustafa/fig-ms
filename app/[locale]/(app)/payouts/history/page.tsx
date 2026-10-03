import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import {
  countPayouts,
  getPayoutsSummary,
  listPayouts,
  type ListPayoutsFilters,
} from "@/lib/payouts";
import { pageCountOf, resolvePage, resolvePageSize } from "@/lib/pagination";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/app-shell/back-link";
import { PayoutsToolbar } from "@/components/payouts/payouts-toolbar";
import { PayoutsList, type PayoutItem } from "@/components/payouts/payouts-list";

export default async function PayoutHistoryPage({
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
  const sp = await searchParams;
  const session = await getSession();
  const role = session?.user?.role;

  const canRequest = hasRole(role, ["treasurer", "admin"]);
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

  const [total, summary] = await Promise.all([
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
    <PayoutHistoryContent
      payouts={payouts}
      total={total}
      page={page}
      pageSize={pageSize}
      summary={summary}
      canRequest={canRequest}
      canManage={canManage}
    />
  );
}

function PayoutHistoryContent({
  payouts,
  total,
  page,
  pageSize,
  summary,
  canRequest,
  canManage,
}: {
  payouts: PayoutItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: Awaited<ReturnType<typeof getPayoutsSummary>>;
  canRequest: boolean;
  canManage: boolean;
}) {
  const t = useTranslations("payoutListing");

  return (
    <div className="space-y-4">
      <BackLink href="/payouts" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {canRequest && (
          <Button
            render={
              <Link href="/payouts/request">
                <Plus className="size-4" />
                {t("requestPayout")}
              </Link>
            }
          />
        )}
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
  );
}
