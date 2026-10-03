"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "@/lib/pagination";

export function PageSizeSelect({
  value,
  onChange,
  className,
}: {
  value: PageSize;
  onChange: (size: PageSize) => void;
  className?: string;
}) {
  const t = useTranslations("pagination");

  return (
    <div className="space-y-1.5">
      <Label>{t("rowsPerPage")}</Label>
      <Select
        value={String(value)}
        onValueChange={(val) => onChange(Number(val) as PageSize)}
      >
        <SelectTrigger aria-label={t("rowsPerPage")} className={className ?? "w-full sm:w-32"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {t("perPage", { size })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
