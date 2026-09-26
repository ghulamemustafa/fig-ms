import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { secondaryNavItems } from "@/lib/nav-items";
import { RoleGate } from "@/components/auth/role-gate";

export default function MorePage() {
  const t = useTranslations("nav");

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">{t("more")}</h1>
      <nav className="divide-y rounded-md border">
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
          return item.labelKey === "settings" ? (
            <RoleGate key={item.href} allow={["admin"]}>
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
