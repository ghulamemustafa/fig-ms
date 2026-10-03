import Image from "next/image";
import { useTranslations } from "next-intl";

import type { Role } from "@/lib/rbac";
import { GlobalSearch } from "@/components/app-shell/global-search";
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { UserMenu } from "@/components/app-shell/user-menu";

export function TopBar({ user }: { user: { name: string; role: Role } }) {
  const tApp = useTranslations("app");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:h-16 md:px-6">
      <span className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        <Image src="/logo.jpg" alt="" width={28} height={28} className="size-7 shrink-0 rounded-full object-cover ring-1 ring-border" />
        <span className="truncate text-sm font-semibold tracking-tight">{tApp("name")}</span>
      </span>
      <span className="hidden flex-1 md:block" />

      <GlobalSearch />

      <LocaleSwitcher />

      <ThemeToggle />

      <UserMenu name={user.name} role={user.role} />
    </header>
  );
}
