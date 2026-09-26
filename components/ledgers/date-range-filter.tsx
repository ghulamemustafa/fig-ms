"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DateRangeFilter({
  from,
  to,
  onChange,
  extra,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  extra?: React.ReactNode;
}) {
  const t = useTranslations("ledgerCommon");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="space-y-1.5">
        <Label>{t("fromLabel")}</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("toLabel")}</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
        />
      </div>
      {extra}
    </div>
  );
}
