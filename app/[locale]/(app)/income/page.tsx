import { useTranslations } from "next-intl";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { IncomeLedger } from "@/components/ledgers/income-ledger";

export default async function IncomePage() {
  const session = await getSession();
  const role = session?.user?.role;
  const canManage = hasRole(role, ["treasurer", "data_entry", "admin"]);
  const canDelete = hasRole(role, ["admin"]);

  return (
    <IncomePageContent canManage={canManage} canDelete={canDelete} />
  );
}

function IncomePageContent({
  canManage,
  canDelete,
}: {
  canManage: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("incomeLedger");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <IncomeLedger canManage={canManage} canDelete={canDelete} />
    </div>
  );
}
