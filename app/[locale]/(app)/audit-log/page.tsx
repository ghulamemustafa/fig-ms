import { useTranslations } from "next-intl";

import { AuthError, requireRole } from "@/lib/auth-guards";
import { AUDIT_ENTITY_TYPES, listAuditLogs } from "@/lib/audit-queries";
import { prisma } from "@/lib/prisma";
import { AuditEntryList } from "@/components/audit/audit-entry-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SearchParams = { entityType?: string; changedBy?: string; from?: string; to?: string };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  try {
    await requireRole(["admin"]);
  } catch (error) {
    if (error instanceof AuthError) return <NotAuthorized />;
    throw error;
  }

  const sp = await searchParams;
  const [entries, users] = await Promise.all([
    listAuditLogs({
      entityType: sp.entityType || undefined,
      changedBy: sp.changedBy || undefined,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(new Date(sp.to).getTime() + 86_400_000) : undefined,
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return <AuditLogContent entries={entries} users={users} values={sp} />;
}

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function AuditLogContent({
  entries,
  users,
  values,
}: {
  entries: Awaited<ReturnType<typeof listAuditLogs>>;
  users: { id: string; name: string }[];
  values: SearchParams;
}) {
  const t = useTranslations("auditLog");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="entityType">{t("filters.entityType")}</Label>
          <select id="entityType" name="entityType" defaultValue={values.entityType ?? ""} className={selectClass}>
            <option value="">{t("filters.all")}</option>
            {AUDIT_ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="changedBy">{t("filters.user")}</Label>
          <select id="changedBy" name="changedBy" defaultValue={values.changedBy ?? ""} className={selectClass}>
            <option value="">{t("filters.all")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">{t("filters.from")}</Label>
          <Input id="from" type="date" name="from" defaultValue={values.from ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">{t("filters.to")}</Label>
          <Input id="to" type="date" name="to" defaultValue={values.to ?? ""} />
        </div>
        <Button type="submit">{t("filters.apply")}</Button>
      </form>

      <AuditEntryList entries={entries} />
    </div>
  );
}

function NotAuthorized() {
  const t = useTranslations("auth");
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">{t("notAuthorizedTitle")}</h1>
      <p className="text-muted-foreground">{t("notAuthorizedBody")}</p>
    </div>
  );
}
