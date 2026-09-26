"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Loader2, Check, Download, FileText } from "lucide-react";

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
  const [upcoming, setUpcoming] = useState<OutstandingMonth[]>([]);
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
    setUpcoming(data.upcoming ?? []);
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
    setUpcoming([]);
    setSelected(new Set());
    setReactivate(false);
    setError(null);
    setSuccess(null);
  }

  // Advance months share the `selected` set with outstanding ones.
  function selectAdvance(count: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      upcoming.forEach((u) => next.delete(u.monthCovered));
      upcoming.slice(0, count).forEach((u) => next.add(u.monthCovered));
      return next;
    });
  }

  const advanceSelectedCount = upcoming.filter((u) => selected.has(u.monthCovered)).length;
  const total = [...outstanding, ...upcoming]
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
        TOO_FAR_AHEAD: t("errors.tooFarAhead"),
        MEMBER_DECEASED: t("errors.deceased"),
      };
      setError((body?.error && map[body.error]) ?? t("errors.generic"));
      return;
    }

    const data = await res.json();
    setSuccess({
      count: data.payments.length,
      receipts: [...new Set<string>(data.payments.map((p: { receiptNo: string }) => p.receiptNo))],
    });
  }

  function renderMonths(months: OutstandingMonth[]) {
    return (
      <div className="divide-y rounded-xl border bg-card">
        {months.map((o) => (
          <label key={o.monthCovered} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <Checkbox
                checked={selected.has(o.monthCovered)}
                onCheckedChange={(checked) => toggleMonth(o.monthCovered, checked === true)}
              />
              {format.dateTime(new Date(o.monthCovered), { month: "long", year: "numeric" })}
            </span>
            <span className="tabular-nums">
              {o.amount}
              {o.wasDoubleFee && <span className="ms-1 text-xs text-muted-foreground">({t("doubleFeeTag")})</span>}
            </span>
          </label>
        ))}
      </div>
    );
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
            {success.receipts.map((no) => (
              <div key={no} className="flex flex-wrap gap-2">
                <Button
                  render={
                    <a href={`/api/receipts/${encodeURIComponent(no)}`} target="_blank" rel="noopener">
                      <FileText className="size-4" />
                      {t("viewReceipt")}
                    </a>
                  }
                />
                <Button
                  variant="outline"
                  render={
                    <a href={`/api/receipts/${encodeURIComponent(no)}?download=1`} download>
                      <Download className="size-4" />
                      {t("downloadReceipt")}
                    </a>
                  }
                />
              </div>
            ))}
            <Button variant="outline" onClick={reset}>{t("recordAnother")}</Button>
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
          <CardContent className="space-y-4">
            {outstanding.length > 0 && renderMonths(outstanding)}

            {upcoming.length > 0 && (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{t("advanceTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("advanceHint")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 3, 6, 12]
                    .filter((n) => n <= upcoming.length)
                    .map((n) => (
                      <Button key={n} type="button" variant="outline" size="sm" onClick={() => selectAdvance(n)}>
                        {t("advanceQuick", { count: n })}
                      </Button>
                    ))}
                  {advanceSelectedCount > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => selectAdvance(0)}>
                      {t("advanceClear")}
                    </Button>
                  )}
                </div>
                {renderMonths(upcoming)}
              </div>
            )}

            {(outstanding.length > 0 || upcoming.length > 0) && (
              <>
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
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
