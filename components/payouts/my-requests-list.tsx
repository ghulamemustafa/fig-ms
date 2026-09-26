"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, HandCoins } from "lucide-react";

import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type MyRequestPayout = {
  id: string;
  payoutType: string;
  amount: string;
  status: string;
  reason: string | null;
  vpRejectReason: string | null;
  presRejectReason: string | null;
  paidDate: string | null;
  member: { id: string; name: string; serialNo: string };
};

const STATUS_VARIANT: Record<string, "secondary" | "destructive" | "default" | "outline"> = {
  requested: "secondary",
  vp_approved: "secondary",
  president_approved: "secondary",
  paid: "default",
  vp_rejected: "destructive",
  president_rejected: "destructive",
};

export function MyRequestsList({ payouts }: { payouts: MyRequestPayout[] }) {
  const t = useTranslations("myRequests");
  const tQueue = useTranslations("payoutQueue");
  const tType = useTranslations("payoutType");
  const tStatus = useTranslations("payoutStatus");
  const router = useRouter();

  if (payouts.length === 0) {
    return <EmptyState icon={HandCoins}>{t("empty")}</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {payouts.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/members/${p.member.id}`} className="font-medium underline">
                  {p.member.name}
                </Link>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {p.member.serialNo}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>
                {tStatus(p.status as keyof typeof STATUS_VARIANT)}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 text-sm">
              <span>{tType(p.payoutType)}</span>
              <span className="tabular-nums">{p.amount}</span>
            </div>

            {p.status === "vp_rejected" && p.vpRejectReason && (
              <p className="text-sm text-destructive">
                {t("rejectedByVp", { reason: p.vpRejectReason })}
              </p>
            )}
            {p.status === "president_rejected" && p.presRejectReason && (
              <p className="text-sm text-destructive">
                {t("rejectedByPresident", { reason: p.presRejectReason })}
              </p>
            )}

            {p.status === "president_approved" && (
              <MarkPaidButton
                payoutId={p.id}
                onDone={() => router.refresh()}
                label={tQueue("markPaidButton")}
                title={tQueue("markPaidTitle")}
                dateLabel={tQueue("paidDateLabel")}
                cancelLabel={tQueue("cancel")}
                confirmLabel={tQueue("confirm")}
                errorFallback={tQueue("errors.generic")}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MarkPaidButton({
  payoutId,
  onDone,
  label,
  title,
  dateLabel,
  cancelLabel,
  confirmLabel,
  errorFallback,
}: {
  payoutId: string;
  onDone: () => void;
  label: string;
  title: string;
  dateLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  errorFallback: string;
}) {
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
      setError(body?.message ?? errorFallback);
      return;
    }
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">{label}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Label>{dateLabel}</Label>
          <Input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
