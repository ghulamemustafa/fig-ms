import { useTranslations } from "next-intl";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { EXPORT_ENTITIES, EXPORT_ROLES, type ExportEntity } from "@/lib/export-access";
import { ReportsExporter } from "@/components/reports/reports-exporter";

export default async function ReportsPage() {
  const session = await getSession();
  const role = session?.user?.role;
  const allowed = EXPORT_ENTITIES.filter((e) => hasRole(role, EXPORT_ROLES[e]));
  return <ReportsContent allowed={allowed} />;
}

function ReportsContent({ allowed }: { allowed: ExportEntity[] }) {
  const t = useTranslations("reportsPage");
  const tAuth = useTranslations("auth");

  if (allowed.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{tAuth("notAuthorizedTitle")}</h1>
        <p className="text-muted-foreground">{tAuth("notAuthorizedBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ReportsExporter allowed={allowed} />
    </div>
  );
}
