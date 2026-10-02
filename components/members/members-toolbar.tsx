"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";

import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, resolvePageSize } from "@/lib/pagination";

const STATUSES = ["all", "active", "removed", "deceased"] as const;

export function MembersToolbar() {
  const t = useTranslations("membersPage");
  const tPagination = useTranslations("pagination");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const status = searchParams.get("status") ?? "all";
  const pageSize = resolvePageSize(searchParams.get("pageSize") ?? undefined);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function updateParams(next: {
    status?: string;
    search?: string;
    pageSize?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { status, search, pageSize, ...next };

    if (merged.status && merged.status !== "all") {
      params.set("status", merged.status);
    } else {
      params.delete("status");
    }

    if (merged.search) {
      params.set("search", merged.search);
    } else {
      params.delete("search");
    }

    if (merged.pageSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(merged.pageSize));
    } else {
      params.delete("pageSize");
    }

    // A new filter or page size invalidates the current page offset.
    params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
        onValueChange={(value) => updateParams({ status: value as string })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`filters.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(pageSize)}
        onValueChange={(value) =>
          updateParams({ pageSize: Number(value as string) })
        }
      >
        <SelectTrigger
          aria-label={tPagination("rowsPerPage")}
          className="w-full sm:w-32"
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
  );
}
