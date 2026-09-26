"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Loader2, Check } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MemberSearchSelect,
  type MemberSearchResult,
} from "@/components/payments/member-search-select";

type OutstandingMonth = {
  monthCovered: string;
  dueDate: string;
  amount: number;
  wasDoubleFee: boolean;
};

type SelectedMember = MemberSearchResult & {
  removedDate: string | null;
  removedReason: string | null;
};

export function CollectPaymentForm() {
  const t = useTranslations("collectPayment");
  const format = useFormatter();

  const [member, setMember] = useState<SelectedMember | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingMonth[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reactivate, setReactivate] = useState(false);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number; receipts: string[] } | null>(
    null
  );

  async function selectMember(m: MemberSearchResult) {
    setError(null);
    setSuccess(null);
    setReactivate(false);
    setLoadingOutstanding(true);
    const res = await fetch(`/api/members/${m.id}/outstanding`);
    const data = await res.json();
    setMember(data.member);
    setOutstanding(data.outstanding);
    setSelected(new Set(data.outstanding.map((o: OutstandingMonth) => o.monthCovered)));
    setLoadingOutstanding(false);
  }

  function toggleMonth(month: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(month);
      else next.delete(month);
      return next;
    });
  }

  function reset() {
    setMember(null);
    setOutstanding([]);
    setSelected(new Set());
    setReactivate(false);
    setError(null);
    setSuccess(null);
  }

  const total = outstanding
    .filter((o) => selected.has(o.monthCovered))
    .reduce((sum, o) => sum + o.amount, 0);

  async function submit() {
    if (!member) return;
    setError(null);

    if (selected.size === 0) {
      setError(t("errors.noneSelected"));
      return;
    }
    if (member.status === "removed" && !reactivate) {
      setError(t("errors.reactivationRequired"));
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: member.id,
        months: Array.from(selected),
        confirmReactivation: reactivate,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const map: Record<string, string> = {
        REACTIVATION_REQUIRED: t("errors.reactivationRequired"),
        ALREADY_PAID: t("errors.alreadyPaid"),
        MEMBER_DECEASED: t("errors.deceased"),
      };
      setError((body?.error && map[body.error]) ?? t("errors.generic"));
      return;
    }

    const data = await res.json();
    setSuccess({
      count: data.payments.length,
      receipts: data.payments.map((p: { receiptNo: string }) => p.receiptNo),
    });
  }

  if (success) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert>
            <Check className="size-4" />
            <AlertDescription>
              {t("success", {
                count: success.count,
                receipts: success.receipts.join(", "),
              })}
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset}>{t("recordAnother")}</Button>
            {member && (
              <Button
                variant="outline"
                render={<Link href={`/members/${member.id}`}>View member</Link>}
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          {member ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {member.serialNo} · {member.cnic}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                {t("changeMember")}
              </Button>
            </div>
          ) : (
            <MemberSearchSelect onSelect={selectMember} />
          )}
        </CardContent>
      </Card>

      {member && member.status === "removed" && (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>
              {t("removedNotice", {
                date: member.removedDate
                  ? format.dateTime(new Date(member.removedDate), { dateStyle: "medium" })
                  : "",
                reason: member.removedReason ?? "",
              })}
            </p>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={reactivate}
                onCheckedChange={(checked) => setReactivate(checked === true)}
              />
              {t("reactivateLabel")}
            </label>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {member && !loadingOutstanding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("outstandingTitle")}</CardTitle>
            {outstanding.length === 0 && (
              <CardDescription>{t("noOutstanding")}</CardDescription>
            )}
          </CardHeader>
          {outstanding.length > 0 && (
            <CardContent className="space-y-3">
              <div className="divide-y rounded-md border">
                {outstanding.map((o) => (
                  <label
                    key={o.monthCovered}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={selected.has(o.monthCovered)}
                        onCheckedChange={(checked) =>
                          toggleMonth(o.monthCovered, checked === true)
                        }
                      />
                      {format.dateTime(new Date(o.monthCovered), {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="tabular-nums">
                      {o.amount}
                      {o.wasDoubleFee && (
                        <span className="ms-1 text-xs text-muted-foreground">
                          ({t("doubleFeeTag")})
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{t("total")}</span>
                <span className="tabular-nums">{total}</span>
              </div>
              <Button
                className="w-full"
                disabled={submitting || selected.size === 0}
                onClick={submit}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? t("submitting") : t("submit")}
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
