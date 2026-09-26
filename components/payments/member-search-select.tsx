"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MemberSearchResult = {
  id: string;
  name: string;
  serialNo: string;
  cnic: string;
  mobile: string;
  status: string;
};

export function MemberSearchSelect({
  onSelect,
}: {
  onSelect: (member: MemberSearchResult) => void;
}) {
  const t = useTranslations("collectPayment");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);

  const visibleResults = query.trim().length < 2 ? [] : results;

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(
        data.members.map((m: MemberSearchResult) => ({
          id: m.id,
          name: m.name,
          serialNo: m.serialNo,
          cnic: m.cnic,
          mobile: m.mobile,
          status: m.status,
        }))
      );
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-start gap-2">
            <Search className="size-4" />
            {t("searchLabel")}
          </Button>
        }
      />
      <PopoverContent className="w-[min(90vw,360px)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("searchPlaceholder")}
          />
          <CommandList>
            {visibleResults.length === 0 && (
              <CommandEmpty>{t("noResults")}</CommandEmpty>
            )}
            <CommandGroup>
              {visibleResults.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onSelect(m);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <div className="flex flex-col">
                    <span>{m.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {m.serialNo} · {m.cnic}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
