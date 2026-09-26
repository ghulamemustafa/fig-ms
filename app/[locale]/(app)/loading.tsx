import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

// Shown inside the app shell while a page's server data is loading. The blocks
// roughly match a typical page (heading, summary cards, a list) so nothing jumps.
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-56 rounded-2xl" />
        <div className="grid gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
