"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";

import type { ExportEntity } from "@/lib/export-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MemberSearchSelect,
  type MemberSearchResult,
} from "@/components/payments/member-search-select";

const ALL = "__all__";
const MEMBER_STATUSES = ["active", "removed", "deceased"] as const;
const PAYOUT_STATUSES = ["requested", "vp_approved", "vp_rejected", "president_approved", "president_rejected", "paid"] as const;
const PAYOUT_TYPES = ["funeral", "widow", "other"] as const;

const year = new Date().getFullYear();

export function ReportsExporter({ allowed }: { allowed: ExportEntity[] }) {
  const t = useTranslations("reportsPage");
  const tMemberStatus = useTranslations("membersPage.status");
  const tPayoutStatus = useTranslations("payoutStatus");
  const tPayoutType = useTranslations("payoutType");

  const [entity, setEntity] = useState<ExportEntity>(allowed[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [category, setCategory] = useState("");
  const [member, setMember] = useState<MemberSearchResult | null>(null);

  function pickEntity(next: ExportEntity) {
    setEntity(next);
    setStatus(ALL);
    setType(ALL);
    setCategory("");
    setMember(null);
    // The period statement needs a range; default it to this calendar year.
    setFrom(next === "statement" ? `${year}-01-01` : "");
    setTo(next === "statement" ? `${year}-12-31` : "");
  }

  function href(format: "csv" | "pdf") {
    if (from && to && to < from) return "#";
    const p = new URLSearchParams({ format });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (status !== ALL && (entity === "members" || entity === "payouts")) p.set("status", status);
    if (type !== ALL && entity === "payouts") p.set("type", type);
    if (category.trim() && entity === "expenses") p.set("category", category.trim());
    if (member && (entity === "payments" || entity === "payouts")) p.set("memberId", member.id);
    return `/api/export/${entity}?${p.toString()}`;
  }

  const showMember = entity === "payments" || entity === "payouts";
  const invalidRange = Boolean(from && to && to < from);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label>{t("reportLabel")}</Label>
            <Select value={entity} onValueChange={(v) => v && pickEntity(v as ExportEntity)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((e) => (
                  <SelectItem key={e} value={e}>
                    {t(`entities.${e}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(`hints.${entity}`)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("from")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("to")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            {entity === "members" && (
              <div className="space-y-1.5">
                <Label>{t("status")}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("all")}</SelectItem>
                    {MEMBER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{tMemberStatus(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {entity === "payouts" && (
              <>
                <div className="space-y-1.5">
                  <Label>{t("status")}</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("all")}</SelectItem>
                      {PAYOUT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{tPayoutStatus(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("type")}</Label>
                  <Select value={type} onValueChange={(v) => setType(v ?? ALL)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("all")}</SelectItem>
                      {PAYOUT_TYPES.map((s) => (
                        <SelectItem key={s} value={s}>{tPayoutType(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {entity === "expenses" && (
              <div className="space-y-1.5">
                <Label>{t("category")}</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("categoryHint")} />
              </div>
            )}
          </div>

          {showMember && (
            <div className="space-y-1.5">
              <Label>{t("member")}</Label>
              {member ? (
                <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span>
                    {member.name} <span className="text-muted-foreground tabular-nums">({member.serialNo})</span>
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label={t("clearMember")} onClick={() => setMember(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <MemberSearchSelect onSelect={setMember} />
              )}
            </div>
          )}

          {invalidRange && <p className="text-sm text-destructive">{t("invalidRange")}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            {entity !== "statement" && (
              <Button
                variant="outline"
                className="sm:w-auto"
                disabled={invalidRange}
                render={
                  <a href={href("csv")} download>
                    <FileSpreadsheet className="size-4" />
                    {t("downloadCsv")}
                  </a>
                }
              />
            )}
            <Button
              className="sm:w-auto"
              disabled={invalidRange}
              render={
                <a href={href("pdf")} download>
                  {entity === "statement" ? <FileText className="size-4" /> : <Download className="size-4" />}
                  {t("downloadPdf")}
                </a>
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
