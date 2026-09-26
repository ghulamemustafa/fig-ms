import type { ReactNode } from "react";

import type { Role } from "@/lib/rbac";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name: string; role: Role };
}) {
  return (
    <div className="flex min-h-full">
      <AppSidebar />
      <div className="flex min-h-full flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 p-4 pb-20 md:pb-4">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
