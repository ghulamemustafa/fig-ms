import { Suspense } from "react";
import { useTranslations } from "next-intl";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { ExpenseLedger } from "@/components/ledgers/expense-ledger";

export default async function ExpensesPage() {
  const session = await getSession();
  const role = session?.user?.role;
  const canManage = hasRole(role, ["treasurer", "data_entry", "admin"]);
  const canDelete = hasRole(role, ["admin"]);

  return <ExpensesPageContent canManage={canManage} canDelete={canDelete} />;
}

function ExpensesPageContent({
  canManage,
  canDelete,
}: {
  canManage: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("expenseLedger");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense>
        <ExpenseLedger canManage={canManage} canDelete={canDelete} />
      </Suspense>
    </div>
  );
}
