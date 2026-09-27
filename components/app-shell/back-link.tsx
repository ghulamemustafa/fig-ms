"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/navigation";

/** A small "back to X" link for pages reached by drilling in, not from the nav directly. */
export function BackLink({ href, label }: { href: string; label?: string }) {
  const t = useTranslations("common");
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4 rtl:rotate-180" />
      {label ?? t("back")}
    </Link>
  );
}
