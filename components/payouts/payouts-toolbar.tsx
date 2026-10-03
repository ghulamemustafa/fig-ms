"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, RotateCcw } from "lucide-react";

import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, resolvePageSize } from "@/lib/pagination";

const STATUSES = [
  "all",
  "requested",
  "vp_approved",
  "president_approved",
  "paid",
  "vp_rejected",
  "president_rejected",
] as const;

const TYPES = ["all", "funeral", "widow", "other"] as const;

export function PayoutsToolbar() {
  const t = useTranslations("payoutListing");
  const tStatus = useTranslations("payoutStatus");
  const tType = useTranslations("payoutType");
  const tPagination = useTranslations("pagination");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const status = searchParams.get("status") ?? "all";
  const payoutType = searchParams.get("type") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const pageSize = resolvePageSize(searchParams.get("pageSize") ?? undefined);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const hasActiveFilters =
    status !== "all" ||
    payoutType !== "all" ||
    Boolean(from) ||
    Boolean(to) ||
    Boolean(search);

  function updateParams(next: {
    status?: string;
    type?: string;
    search?: string;
    from?: string;
    to?: string;
    pageSize?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { status, type: payoutType, search, from, to, pageSize, ...next };

    if (merged.status && merged.status !== "all") {
      params.set("status", merged.status);
    } else {
      params.delete("status");
    }

    if (merged.type && merged.type !== "all") {
      params.set("type", merged.type);
    } else {
      params.delete("type");
    }

    if (merged.search && merged.search.trim()) {
      params.set("search", merged.search.trim());
    } else {
      params.delete("search");
    }

    if (merged.from) {
      params.set("from", merged.from);
    } else {
      params.delete("from");
    }

    if (merged.to) {
      params.set("to", merged.to);
    } else {
      params.delete("to");
    }

    if (merged.pageSize && merged.pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(merged.pageSize));
    } else {
      params.delete("pageSize");
    }

    // Changing any filter invalidates the current page offset.
    params.delete("page");

    startTransition(() => {
      const q = params.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    });
  }

  function resetAll() {
    setSearch("");
    const params = new URLSearchParams();
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(pageSize));
    }
    startTransition(() => {
      const q = params.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-(--shadow-soft)">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateParams({ search });
            }}
            onBlur={() => updateParams({ search })}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>

        <Select
          value={status}
          onValueChange={(val) => updateParams({ status: val ?? undefined })}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? t("allStatuses") : tStatus(s as keyof typeof tStatus)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={payoutType}
          onValueChange={(val) => updateParams({ type: val ?? undefined })}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder={t("type")} />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {tp === "all" ? t("allTypes") : tType(tp as keyof typeof tType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="payout-from" className="text-xs text-muted-foreground">
              {t("from")}:
            </Label>
            <Input
              id="payout-from"
              type="date"
              value={from}
              onChange={(e) => updateParams({ from: e.target.value })}
              className="h-9 w-auto text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Label htmlFor="payout-to" className="text-xs text-muted-foreground">
              {t("to")}:
            </Label>
            <Input
              id="payout-to"
              type="date"
              value={to}
              onChange={(e) => updateParams({ to: e.target.value })}
              className="h-9 w-auto text-xs"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAll}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="me-1 size-3.5" />
              {t("resetFilters")}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">
            {tPagination("rowsPerPage")}:
          </Label>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => updateParams({ pageSize: Number(val) })}
          >
            <SelectTrigger
              aria-label={tPagination("rowsPerPage")}
              className="h-9 w-28 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {tPagination("perPage", { size })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
