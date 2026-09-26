import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { secondaryNavItems } from "@/lib/nav-items";
import { REPORTS_ROLES } from "@/lib/export-access";
import { RoleGate } from "@/components/auth/role-gate";

export default function MorePage() {
  const t = useTranslations("nav");

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t("more")}</h1>
      <nav className="divide-y overflow-hidden rounded-2xl border bg-card shadow-(--shadow-soft)">
        {secondaryNavItems.map((item) => {
          const link = (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent"
            >
              <item.icon className="size-4" />
              {t(item.labelKey)}
            </Link>
          );
          return (item.labelKey === "settings" || item.labelKey === "auditLog" || item.labelKey === "reports") ? (
            <RoleGate key={item.href} allow={item.labelKey === "reports" ? REPORTS_ROLES : ["admin"]}>
              {link}
            </RoleGate>
          ) : (
            link
          );
        })}
      </nav>
    </div>
  );
}
