import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

// Shown inside the app shell while a page's server data is loading.
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
