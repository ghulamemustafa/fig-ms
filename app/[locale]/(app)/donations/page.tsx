import { useTranslations } from "next-intl";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { DonationLedger } from "@/components/ledgers/donation-ledger";

export default async function DonationsPage() {
  const session = await getSession();
  const role = session?.user?.role;
  const canManage = hasRole(role, ["treasurer", "data_entry", "admin"]);
  const canDelete = hasRole(role, ["admin"]);

  return <DonationsPageContent canManage={canManage} canDelete={canDelete} />;
}

function DonationsPageContent({
  canManage,
  canDelete,
}: {
  canManage: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("donationLedger");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <DonationLedger canManage={canManage} canDelete={canDelete} />
    </div>
  );
}
