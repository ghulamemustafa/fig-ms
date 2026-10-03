import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { listDefaulters } from "@/lib/payments";
import { resolvePageSize } from "@/lib/pagination";
import { BackLink } from "@/components/app-shell/back-link";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { DefaultersToolbar } from "@/components/payments/defaulters-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DefaultersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const pageSize = resolvePageSize(sp.pageSize);
  const requestedPage = sp.page ? Number(sp.page) : 1;

  const { defaulters, total, page } = await listDefaulters({
    page: requestedPage,
    pageSize,
  });

  return (
    <DefaultersContent
      defaulters={defaulters}
      page={page}
      pageSize={pageSize}
      total={total}
    />
  );
}

function DefaultersContent({
  defaulters,
  page,
  pageSize,
  total,
}: {
  defaulters: Awaited<ReturnType<typeof listDefaulters>>["defaulters"];
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = useTranslations("defaulters");

  return (
    <div className="space-y-4">
      <BackLink href="/payments" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {total > 0 && <DefaultersToolbar />}
      </div>

      {total === 0 ? (
        <EmptyState icon={CheckCircle2}>{t("empty")}</EmptyState>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-(--shadow-soft) md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.serialNo")}</TableHead>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.mobile")}</TableHead>
                  <TableHead>{t("table.unpaidMonths")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaulters.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="p-0">
                      <Link href={`/members/${m.id}`} className="block px-4 py-2 tabular-nums">
                        {m.serialNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/members/${m.id}`} className="block">
                        {m.name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{m.mobile}</TableCell>
                    <TableCell>
                      <Severity unpaidMonths={m.unpaidMonths} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {defaulters.map((m) => (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                className="rounded-2xl border bg-card p-4 shadow-(--shadow-soft)"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {m.serialNo}
                    </p>
                  </div>
                  <Severity unpaidMonths={m.unpaidMonths} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                  {m.mobile}
                </p>
              </Link>
            ))}
          </div>

          <Pagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}

function Severity({ unpaidMonths }: { unpaidMonths: number }) {
  const t = useTranslations("defaulters");
  const pendingReview = unpaidMonths >= 3;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={pendingReview ? "destructive" : "outline"}>
        {t("monthsBehind", { count: unpaidMonths })}
      </Badge>
      {pendingReview && (
        <Badge variant="destructive">{t("pendingReview")}</Badge>
      )}
    </div>
  );
}
