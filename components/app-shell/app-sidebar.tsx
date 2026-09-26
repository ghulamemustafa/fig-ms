"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { primaryNavItems, secondaryNavItems } from "@/lib/nav-items";
import { Separator } from "@/components/ui/separator";
import { REPORTS_ROLES } from "@/lib/export-access";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils";

function SidebarLink({
  href,
  label,
  Icon,
  isActive,
}: {
  href: string;
  label: string;
  Icon: (typeof primaryNavItems)[number]["icon"];
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function AppSidebar() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-e bg-background md:flex">
      <div className="flex h-14 items-center px-4 text-base font-semibold">
        {tApp("name")}
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {primaryNavItems
          .filter((item) => item.labelKey !== "more")
          .map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={t(item.labelKey)}
              Icon={item.icon}
              isActive={isActive(item.href)}
            />
          ))}

        <Separator className="my-2" />

        {secondaryNavItems.map((item) => {
          const link = (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={t(item.labelKey)}
              Icon={item.icon}
              isActive={isActive(item.href)}
            />
          );
          // Settings is admin-only — see requireRole(["admin"]) on the page itself.
          return (item.labelKey === "settings" || item.labelKey === "auditLog" || item.labelKey === "reports") ? (
            <RoleGate key={item.href} allow={item.labelKey === "reports" ? REPORTS_ROLES : ["admin"]}>
              {link}
            </RoleGate>
          ) : (
            link
          );
        })}
      </nav>
    </aside>
  );
}
