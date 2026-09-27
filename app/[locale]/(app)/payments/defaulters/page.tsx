import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { getDefaulters } from "@/lib/payments";
import { BackLink } from "@/components/app-shell/back-link";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DefaultersPage() {
  const defaulters = await getDefaulters();

  return <DefaultersContent defaulters={defaulters} />;
}

function DefaultersContent({
  defaulters,
}: {
  defaulters: Awaited<ReturnType<typeof getDefaulters>>;
}) {
  const t = useTranslations("defaulters");

  return (
    <div className="space-y-4">
      <BackLink href="/payments" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {defaulters.length === 0 ? (
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
