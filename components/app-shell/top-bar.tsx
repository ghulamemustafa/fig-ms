import { useTranslations } from "next-intl";

import type { Role } from "@/lib/rbac";
import { GlobalSearch } from "@/components/app-shell/global-search";
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";

export function TopBar({ user }: { user: { name: string; role: Role } }) {
  const tApp = useTranslations("app");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold md:flex-none md:text-base">
        {tApp("name")}
      </span>

      <GlobalSearch />

      <LocaleSwitcher />

      <UserMenu name={user.name} role={user.role} />
    </header>
  );
}
