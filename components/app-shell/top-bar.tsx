import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import type { Role } from "@/lib/rbac";
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Input } from "@/components/ui/input";

export function TopBar({ user }: { user: { name: string; role: Role } }) {
  const t = useTranslations("topbar");
  const tApp = useTranslations("app");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
      <span className="shrink-0 truncate text-sm font-semibold md:text-base">
        {tApp("name")}
      </span>

      <div className="relative ms-auto flex-1 max-w-md">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("searchPlaceholder")}
          className="ps-9"
        />
      </div>

      <LocaleSwitcher />

      <UserMenu name={user.name} role={user.role} />
    </header>
  );
}
