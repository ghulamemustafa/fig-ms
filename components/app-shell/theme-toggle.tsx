"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", className)}
            aria-label={t("switchTheme")}
          >
            <span className="relative flex size-4 items-center justify-center">
              <Sun className="size-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
            </span>
            <span className="hidden sm:inline">{t("toggle")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          data-active={theme === "light"}
          className="flex items-center justify-between data-[active=true]:font-medium"
        >
          <span className="flex items-center gap-2">
            <Sun className="size-4 text-muted-foreground" />
            <span>{t("light")}</span>
          </span>
          {theme === "light" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          data-active={theme === "dark"}
          className="flex items-center justify-between data-[active=true]:font-medium"
        >
          <span className="flex items-center gap-2">
            <Moon className="size-4 text-muted-foreground" />
            <span>{t("dark")}</span>
          </span>
          {theme === "dark" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          data-active={theme === "system"}
          className="flex items-center justify-between data-[active=true]:font-medium"
        >
          <span className="flex items-center gap-2">
            <Monitor className="size-4 text-muted-foreground" />
            <span>{t("system")}</span>
          </span>
          {theme === "system" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
