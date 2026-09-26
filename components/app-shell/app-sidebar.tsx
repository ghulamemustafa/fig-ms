"use client";

import Image from "next/image";
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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {isActive && (
        <span aria-hidden className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary" />
      )}
      <Icon className={cn("size-4 transition-colors", isActive && "text-primary")} />
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
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-e bg-sidebar md:sticky md:top-0 md:flex">
      <div className="flex h-16 items-center gap-3 px-4">
        <Image
          src="/logo.jpg"
          alt=""
          width={36}
          height={36}
          className="size-9 rounded-full object-cover ring-1 ring-border"
        />
        <span className="text-sm leading-tight font-semibold tracking-tight">{tApp("name")}</span>
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
