import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

// Locale-aware 404: shown for any unmatched path under /en or /ur.
export default function NotFound() {
  const t = useTranslations("notFoundPage");

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <Image
        src="/logo.jpg"
        alt=""
        width={64}
        height={64}
        className="size-16 rounded-full object-cover ring-1 ring-border"
      />
      <div className="space-y-1.5">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <Button render={<Link href="/">{t("action")}</Link>} />
    </div>
  );
}
