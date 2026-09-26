import { useTranslations } from "next-intl";

import { requireRole, AuthError } from "@/lib/auth-guards";
import { CollectPaymentForm } from "@/components/payments/collect-payment-form";

export default async function CollectPaymentPage() {
  try {
    await requireRole(["treasurer", "data_entry"]);
  } catch (error) {
    if (error instanceof AuthError) return <NotAuthorized />;
    throw error;
  }

  return <CollectPaymentContent />;
}

function CollectPaymentContent() {
  const t = useTranslations("collectPayment");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <CollectPaymentForm />
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
