import type { ReactNode } from "react";

import type { Role } from "@/lib/rbac";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { Watermark } from "@/components/app-shell/watermark";
import { ProgressBar } from "@/components/app-shell/progress-bar";

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name: string; role: Role };
}) {
  return (
    <div className="flex min-h-full">
      <ProgressBar />
      <Watermark />
      <AppSidebar />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
