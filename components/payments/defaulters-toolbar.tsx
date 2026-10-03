"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useRouter, usePathname } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, resolvePageSize } from "@/lib/pagination";

export function DefaultersToolbar() {
  const tPagination = useTranslations("pagination");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const pageSize = resolvePageSize(searchParams.get("pageSize") ?? undefined);

  function handlePageSizeChange(nextSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(nextSize));
    } else {
      params.delete("pageSize");
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(pageSize)}
        onValueChange={(val) => handlePageSizeChange(Number(val))}
      >
        <SelectTrigger
          aria-label={tPagination("rowsPerPage")}
          className="w-32"
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
