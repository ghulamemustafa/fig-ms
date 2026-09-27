import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import type { MemberStatus } from "@/lib/members";
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

export type MemberListRow = {
  id: string;
  serialNo: string;
  name: string;
  cnic: string;
  mobile: string;
  status: string;
  fundEligible: boolean;
};

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("membersPage");
  const variant = status === "active" ? "secondary" : "outline";
  return (
    <Badge variant={variant}>
      {t(`status.${status as MemberStatus}`)}
    </Badge>
  );
}

function EligibleBadge({ eligible }: { eligible: boolean }) {
  const t = useTranslations("membersPage");
  return (
    <Badge variant={eligible ? "default" : "outline"}>
      {eligible ? t("eligible") : t("notEligible")}
    </Badge>
  );
}

export function MemberList({ members }: { members: MemberListRow[] }) {
  const t = useTranslations("membersPage");

  if (members.length === 0) {
    return <EmptyState icon={Users}>{t("empty")}</EmptyState>;
  }

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-(--shadow-soft) md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.serialNo")}</TableHead>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.cnic")}</TableHead>
              <TableHead>{t("table.mobile")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.fundEligible")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id} className="cursor-pointer">
                <TableCell className="p-0">
                  <Link
                    href={`/members/${member.id}`}
                    className="block px-4 py-2 tabular-nums"
                  >
                    {member.serialNo}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/members/${member.id}`} className="block">
                    {member.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm tabular-nums">{member.cnic}</TableCell>
                <TableCell className="font-mono text-sm tabular-nums">{member.mobile}</TableCell>
                <TableCell>
                  <StatusBadge status={member.status} />
                </TableCell>
                <TableCell>
                  <EligibleBadge eligible={member.fundEligible} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <div className="grid gap-3 md:hidden">
        {members.map((member) => (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="rounded-2xl border bg-card p-4 shadow-(--shadow-soft) transition-all duration-150 active:scale-[0.98] active:shadow-none"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {member.serialNo}
                </p>
              </div>
              <StatusBadge status={member.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
              <span className="tabular-nums">{member.mobile}</span>
              <EligibleBadge eligible={member.fundEligible} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
