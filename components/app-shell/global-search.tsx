"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Result = { id: string; name: string; cnic: string; serialNo: string; status: string };

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const MAX_RESULTS = 6;

function SearchPanel({
  autoFocus,
  onNavigate,
  className,
}: {
  autoFocus?: boolean;
  onNavigate: () => void;
  className?: string;
}) {
  const t = useTranslations("globalSearch");
  const tStatus = useTranslations("membersPage.status");
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<{ query: string; results: Result[] } | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const active = trimmed.length >= MIN_CHARS;
  const settled = loaded?.query === trimmed;
  const results = active && settled ? loaded.results : [];

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/members?q=${encodeURIComponent(trimmed)}&limit=${MAX_RESULTS}`
      );
      if (cancelled || !res.ok) return;
      const data = await res.json();
      if (!cancelled) setLoaded({ query: trimmed, results: data.members });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [active, trimmed]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showPanel = open && active;

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
      <Input
        type="text"
        inputMode="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-label={t("label")}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={t("placeholder")}
        className="ps-9"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          {!settled ? (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("searching")}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            results.map((m) => (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  onNavigate();
                }}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {m.cnic} · {m.serialNo}
                  </span>
                </span>
                <Badge variant={m.status === "active" ? "secondary" : "outline"}>
                  {tStatus(m.status as "active" | "removed" | "deceased")}
                </Badge>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function GlobalSearch() {
  const t = useTranslations("globalSearch");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      {/* Desktop: persistent inline input */}
      <SearchPanel className="ms-auto hidden max-w-md flex-1 md:block" onNavigate={() => {}} />

      {/* Mobile: one tap on the icon opens a full-width search overlay */}
      <div className="md:hidden">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="icon" aria-label={t("label")}>
                <Search className="size-4" />
              </Button>
            }
          />
          <DialogContent className="top-4! translate-y-0! gap-2">
            <DialogTitle className="sr-only">{t("label")}</DialogTitle>
            <SearchPanel autoFocus onNavigate={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
