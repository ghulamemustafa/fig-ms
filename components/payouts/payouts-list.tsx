"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  HandCoins,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Calendar,
} from "lucide-react";

import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import type { PayoutsSummary } from "@/lib/payouts";

export type PayoutItem = {
  id: string;
  payoutType: string;
  amount: string;
  status: string;
  autoApproved: boolean;
  reason: string | null;
  vpRejectReason: string | null;
  presRejectReason: string | null;
  createdAt: string;
  paidDate: string | null;
  member: {
    id: string;
    name: string;
    serialNo: string;
    cnic?: string;
  };
  requestedBy: {
    id: string;
    name: string;
  } | null;
  vpDecisionBy: {
    id: string;
    name: string;
  } | null;
  presDecisionBy: {
    id: string;
    name: string;
  } | null;
};

const STATUS_VARIANT: Record<string, "secondary" | "destructive" | "default" | "outline"> = {
  requested: "secondary",
  vp_approved: "secondary",
  president_approved: "secondary",
  paid: "default",
  vp_rejected: "destructive",
  president_rejected: "destructive",
};

export function PayoutsList({
  payouts,
  total,
  page,
  pageSize,
  summary,
  canManage = false,
}: {
  payouts: PayoutItem[];
  total: number;
  page: number;
  pageSize: number;
  summary?: PayoutsSummary;
  canManage?: boolean;
}) {
  const t = useTranslations("payoutListing");
  const tStatus = useTranslations("payoutStatus");
  const tType = useTranslations("payoutType");
  const tQueue = useTranslations("payoutQueue");
  const format = useFormatter();
  const router = useRouter();

  function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return format.dateTime(d, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso.slice(0, 10);
    }
  }

  function formatMoney(amount: number | string) {
    const num = Number(amount);
    return isNaN(num) ? "0" : format.number(num);
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4 shadow-(--shadow-soft)">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{t("kpi.totalPayouts")}</span>
              <HandCoins className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {format.number(summary.totalCount)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              ₨ {formatMoney(summary.totalAmount)}
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-(--shadow-soft)">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-medium">{t("kpi.totalDisbursed")}</span>
              <CheckCircle2 className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
              ₨ {formatMoney(summary.paidAmount)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {format.number(summary.paidCount)} {tStatus("paid").toLowerCase()}
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-(--shadow-soft)">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-xs font-medium">{t("kpi.totalPending")}</span>
              <Clock className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
              ₨ {formatMoney(summary.pendingAmount)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {format.number(summary.pendingCount)} {t("kpi.totalPending").toLowerCase()}
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-(--shadow-soft)">
            <div className="flex items-center justify-between text-destructive">
              <span className="text-xs font-medium">{t("kpi.totalRejected")}</span>
              <XCircle className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-destructive">
              {format.number(summary.rejectedCount)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              ₨ {formatMoney(summary.rejectedAmount)}
            </p>
          </div>
        </div>
      )}

      {payouts.length === 0 ? (
        <EmptyState icon={HandCoins}>{t("empty")}</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-(--shadow-soft)">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">{t("table.date")}</TableHead>
                  <TableHead>{t("table.member")}</TableHead>
                  <TableHead className="w-28">{t("table.type")}</TableHead>
                  <TableHead className="w-28 text-end">{t("table.amount")}</TableHead>
                  <TableHead className="w-36">{t("table.status")}</TableHead>
                  <TableHead>{t("table.workflow")}</TableHead>
                  <TableHead className="max-w-xs">{t("table.reason")}</TableHead>
                  <TableHead className="w-28 text-end">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => {
                  const isAutoApproved = p.autoApproved && p.status === "president_approved";
                  const canPayNow = canManage && p.status === "president_approved";

                  return (
                    <TableRow key={p.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/members/${p.member.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {p.member.name}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">{p.member.serialNo}</span>
                          {p.member.cnic && (
                            <>
                              <span>•</span>
                              <span className="font-mono tabular-nums">{p.member.cnic}</span>
                            </>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-normal whitespace-nowrap">
                          {tType(p.payoutType as "funeral" | "widow" | "other")}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-end font-semibold tabular-nums whitespace-nowrap">
                        ₨ {formatMoney(p.amount)}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANT[p.status] ?? "outline"}
                          className="whitespace-nowrap"
                        >
                          {isAutoApproved
                            ? tStatus("autoApproved")
                            : tStatus(p.status as keyof typeof STATUS_VARIANT)}
                        </Badge>
                        {p.paidDate && (
                          <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                            {formatDate(p.paidDate)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {p.requestedBy && (
                          <div>
                            {tQueue("requestedBy", { name: p.requestedBy.name })}
                          </div>
                        )}
                        {p.autoApproved ? (
                          <div className="text-muted-foreground italic">
                            {t("workflow.notRequired")}
                          </div>
                        ) : (
                          <>
                            {p.vpDecisionBy && (
                              <div className="text-foreground/80">
                                {t("workflow.vpApproved", { name: p.vpDecisionBy.name })}
                              </div>
                            )}
                            {p.presDecisionBy && (
                              <div className="text-foreground/80">
                                {t("workflow.presidentApproved", { name: p.presDecisionBy.name })}
                              </div>
                            )}
                          </>
                        )}
                        {p.status === "vp_rejected" && p.vpRejectReason && (
                          <div className="text-destructive font-medium">
                            {t("workflow.vpRejected", { reason: p.vpRejectReason })}
                          </div>
                        )}
                        {p.status === "president_rejected" && p.presRejectReason && (
                          <div className="text-destructive font-medium">
                            {t("workflow.presidentRejected", { reason: p.presRejectReason })}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {p.reason ? (
                          <span title={p.reason} className="line-clamp-2">
                            {p.reason}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell className="text-end">
                        {canPayNow ? (
                          <MarkPaidDialog
                            payoutId={p.id}
                            memberName={p.member.name}
                            amount={p.amount}
                            onSuccess={() => router.refresh()}
                          />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            render={
                              <Link href={`/members/${p.member.id}`}>
                                <Calendar className="size-3.5" />
                              </Link>
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="border-t p-3">
            <Pagination page={page} pageSize={pageSize} total={total} />
          </div>
        </div>
      )}
    </div>
  );
}

function MarkPaidDialog({
  payoutId,
  memberName,
  amount,
  onSuccess,
}: {
  payoutId: string;
  memberName: string;
  amount: string;
  onSuccess: () => void;
}) {
  const tQueue = useTranslations("payoutQueue");
  const [open, setOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/payouts/${payoutId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paidDate }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? tQueue("errors.generic"));
      return;
    }

    setOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-8 text-xs font-medium">
            {tQueue("markPaidButton")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tQueue("markPaidTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">{memberName}</div>
            <div className="text-muted-foreground">Amount: ₨ {amount}</div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label>{tQueue("paidDateLabel")}</Label>
            <Input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tQueue("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="me-1.5 size-4 animate-spin" />}
            {tQueue("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
