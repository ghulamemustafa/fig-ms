"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Check, X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type QueuePayout = {
  id: string;
  payoutType: string;
  amount: string;
  reason: string | null;
  status: string;
  member: { id: string; name: string; serialNo: string };
  requestedBy: { name: string } | null;
  vpDecisionBy: { name: string } | null;
};

export function PayoutQueueList({
  payouts,
  decisionKind,
  showVpApprover = false,
}: {
  payouts: QueuePayout[];
  decisionKind: "vp-decision" | "president-decision";
  showVpApprover?: boolean;
}) {
  const t = useTranslations("payoutQueue");
  const tType = useTranslations("payoutType");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<Set<string>>(new Set());

  async function decide(id: string, decision: "approve" | "reject", reason?: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/payouts/${id}/${decisionKind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? t("errors.generic"));
      return;
    }

    setDecided((prev) => new Set(prev).add(id));
    setRejectOpen(null);
    setRejectReason("");
  }

  const visible = payouts.filter((p) => !decided.has(p.id));

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {visible.map((payout) => (
        <Card key={payout.id}>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/members/${payout.member.id}`} className="font-medium underline">
                  {payout.member.name}
                </Link>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {payout.member.serialNo}
                </p>
              </div>
              <Badge>{tType(payout.payoutType)}</Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                {t("amount")}: <span className="tabular-nums">{payout.amount}</span>
              </span>
              {payout.requestedBy && (
                <span className="text-muted-foreground">
                  {t("requestedBy", { name: payout.requestedBy.name })}
                </span>
              )}
              {showVpApprover && payout.vpDecisionBy && (
                <span className="text-muted-foreground">
                  {t("vpApprovedBy", { name: payout.vpDecisionBy.name })}
                </span>
              )}
            </div>
            {payout.reason && (
              <p className="text-sm text-muted-foreground">
                {t("reason")}: {payout.reason}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button size="sm" disabled={busyId === payout.id}>
                      {busyId === payout.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {t("approve")}
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("confirmApproveTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{payout.member.name}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => decide(payout.id, "approve")}>
                      {t("confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Dialog
                open={rejectOpen === payout.id}
                onOpenChange={(open) => setRejectOpen(open ? payout.id : null)}
              >
                <DialogTrigger
                  render={
                    <Button variant="destructive" size="sm" disabled={busyId === payout.id}>
                      <X className="size-4" />
                      {t("reject")}
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("rejectTitle")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1.5 py-2">
                    <Label>{t("rejectReasonLabel")}</Label>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectOpen(null)}>
                      {t("cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!rejectReason.trim() || busyId === payout.id}
                      onClick={() => decide(payout.id, "reject", rejectReason)}
                    >
                      {busyId === payout.id && <Loader2 className="size-4 animate-spin" />}
                      {t("confirm")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
