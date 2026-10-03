"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { pageCountOf } from "@/lib/pagination";

export type PaginationProps = {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  total: number;
  /** Search param carrying the page number. */
  paramName?: string;
  /** Optional callback. If omitted, Pagination updates the URL paramName via router.push. */
  onPageChange?: (page: number) => void;
};

export function Pagination({
  page,
  pageSize,
  total,
  paramName = "page",
  onPageChange,
}: PaginationProps) {
  const t = useTranslations("pagination");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pageCount = pageCountOf(total, pageSize);
  if (pageCount <= 1) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  function goTo(next: number) {
    if (onPageChange) {
      onPageChange(next);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    // Page 1 is the default — keep it out of the URL.
    if (next <= 1) {
      params.delete(paramName);
    } else {
      params.set(paramName, String(next));
    }
    const query = params.toString();

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <nav
      aria-label={t("label")}
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {t("showing", { start: rangeStart, end: rangeEnd, total })}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isPending}
          onClick={() => goTo(page - 1)}
        >
          <ChevronLeft className="rtl:rotate-180" />
          {t("previous")}
        </Button>

        <span className="px-1 text-sm text-muted-foreground tabular-nums">
          {t("pageOf", { page, pageCount })}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount || isPending}
          onClick={() => goTo(page + 1)}
        >
          {t("next")}
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
    </nav>
  );
}
