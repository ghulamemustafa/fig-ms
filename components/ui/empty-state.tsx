import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Quiet placeholder for lists with nothing in them yet. */
export function EmptyState({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center",
        className
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
