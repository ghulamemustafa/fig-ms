"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useFormatter } from "next-intl";
import { Loader2, Plus, Pencil, Receipt } from "lucide-react";
import type { z } from "zod";

import { expenseEntrySchema } from "@/lib/schemas/ledger";
import { DEFAULT_PAGE_SIZE, pageCountOf, resolvePage, resolvePageSize, type PageSize } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateRangeFilter } from "@/components/ledgers/date-range-filter";
import { DeleteEntryDialog } from "@/components/ledgers/delete-entry-dialog";
import { PageSizeSelect } from "@/components/ledgers/page-size-select";
import { Pagination } from "@/components/ui/pagination";

type ExpenseEntry = {
  id: string;
  date: string;
  category: string;
  amount: string;
  description: string | null;
  approvedBy: string | null;
};

type FormInput = z.input<typeof expenseEntrySchema>;
type FormOutput = z.output<typeof expenseEntrySchema>;

const ALL_CATEGORIES = "__all__";

export function ExpenseLedger({
  canManage,
  canDelete,
}: {
  canManage: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("expenseLedger");
  const tCommon = useTranslations("ledgerCommon");
  const format = useFormatter();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const pageSize = resolvePageSize(searchParams.get("pageSize") ?? undefined);
  const rawPage = searchParams.get("page") ?? undefined;
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const categoryParam = searchParams.get("category") ?? ALL_CATEGORIES;

  const [range, setRange] = useState({ from: fromParam, to: toParam });
  const [category, setCategory] = useState(categoryParam);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [dialogEntry, setDialogEntry] = useState<ExpenseEntry | "new" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const page = resolvePage(rawPage, pageCountOf(count, pageSize));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (category !== ALL_CATEGORIES) params.set("category", category);
      if (page > 1) params.set("page", String(page));
      if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      if (!cancelled) {
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setCategories(data.categories ?? []);
        setCount(data.count ?? 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, category, page, pageSize, refreshKey]);

  function handleRangeChange(next: { from: string; to: string }) {
    setRange(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.from) params.set("from", next.from);
    else params.delete("from");
    if (next.to) params.set("to", next.to);
    else params.delete("to");
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleCategoryChange(nextCat: string | null) {
    const cat = nextCat ?? ALL_CATEGORIES;
    setCategory(cat);
    const params = new URLSearchParams(searchParams.toString());
    if (cat && cat !== ALL_CATEGORIES) {
      params.set("category", cat);
    } else {
      params.delete("category");
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handlePageSizeChange(nextSize: PageSize) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSize !== DEFAULT_PAGE_SIZE) {
      params.set("pageSize", String(nextSize));
    } else {
      params.delete("pageSize");
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          onChange={handleRangeChange}
          extra={
            <>
              <div className="space-y-1.5">
                <Label>{t("categoryFilterLabel")}</Label>
                <Select
                  value={category}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CATEGORIES}>{t("allCategories")}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
            </>
          }
        />
        {canManage && (
          <Button onClick={() => setDialogEntry("new")} className="w-full sm:w-auto">
            <Plus className="size-4" />
            {tCommon("addEntry")}
          </Button>
        )}
      </div>

      <p className="text-sm font-medium">
        {tCommon("total")}: <span className="font-mono tabular-nums">{total}</span>
      </p>

      {entries.length === 0 ? (
        <EmptyState icon={Receipt}>{tCommon("empty")}</EmptyState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-(--shadow-soft) md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.date")}</TableHead>
                  <TableHead>{t("table.category")}</TableHead>
                  <TableHead>{t("table.description")}</TableHead>
                  <TableHead>{t("table.amount")}</TableHead>
                  {(canManage || canDelete) && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(new Date(entry.date), { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell className="font-medium">{entry.category}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground" title={entry.description ?? undefined}>
                      {entry.description || "—"}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums whitespace-nowrap">{entry.amount}</TableCell>
                    {(canManage || canDelete) && (
                      <TableCell className="flex justify-end gap-1">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={tCommon("edit")}
                            onClick={() => setDialogEntry(entry)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <DeleteEntryDialog onDelete={() => handleDelete(entry.id)} />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border bg-card p-4 shadow-(--shadow-soft)">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(entry.date), { dateStyle: "medium" })}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums">{entry.amount}</span>
                </div>
                {entry.description && (
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                    {entry.description}
                  </p>
                )}
                {(canManage || canDelete) && (
                  <div className="mt-2 flex justify-end gap-1">
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tCommon("edit")}
                        onClick={() => setDialogEntry(entry)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && <DeleteEntryDialog onDelete={() => handleDelete(entry.id)} />}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={count}
          />
        </>
      )}

      {dialogEntry && (
        <ExpenseEntryDialog
          entry={dialogEntry === "new" ? null : dialogEntry}
          onClose={() => setDialogEntry(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function ExpenseEntryDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: ExpenseEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("expenseLedger");
  const tCommon = useTranslations("ledgerCommon");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(expenseEntrySchema),
    defaultValues: entry
      ? {
          date: entry.date.slice(0, 10),
          category: entry.category,
          amount: Number(entry.amount),
          description: entry.description ?? "",
          approvedBy: entry.approvedBy ?? "",
        }
      : {
          date: new Date().toISOString().slice(0, 10),
          category: "",
          amount: 0,
          description: "",
          approvedBy: "",
        },
  });

  async function onSubmit(values: FormOutput) {
    setSubmitError(null);
    const url = entry ? `/api/expenses/${entry.id}` : "/api/expenses";
    const method = entry ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      setSubmitError(tCommon("errors.generic"));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{entry ? tCommon("editEntry") : tCommon("addEntry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label>{tCommon("dateLabel")}</Label>
              <Input type="date" {...register("date")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("categoryLabel")}</Label>
              <Input {...register("category")} />
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{tCommon("amountLabel")}</Label>
              <Input type="number" min="1" step="1" {...register("amount")} />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("descriptionLabel")}</Label>
              <Textarea {...register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("approvedByLabel")}</Label>
              <Input {...register("approvedBy")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
