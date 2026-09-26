import { useTranslations } from "next-intl";

import { requireRole, AuthError } from "@/lib/auth-guards";
import { PayoutRequestForm } from "@/components/payouts/payout-request-form";

export default async function RequestPayoutPage() {
  try {
    await requireRole(["treasurer", "admin"]);
  } catch (error) {
    if (error instanceof AuthError) return <NotAuthorized />;
    throw error;
  }

  return <RequestPayoutContent />;
}

function RequestPayoutContent() {
  const t = useTranslations("payoutRequest");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <PayoutRequestForm />
    </div>
  );
}

function NotAuthorized() {
  const t = useTranslations("auth");
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t("notAuthorizedTitle")}</h1>
      <p className="text-muted-foreground">{t("notAuthorizedBody")}</p>
    </div>
  );
}
