import { useTranslations } from "next-intl";

import { requireRole, AuthError } from "@/lib/auth-guards";
import { listPayouts } from "@/lib/payouts";
import { MyRequestsList, type MyRequestPayout } from "@/components/payouts/my-requests-list";
import { BackLink } from "@/components/app-shell/back-link";

export default async function MyRequestsPage() {
  let userId: string;
  try {
    const session = await requireRole(["treasurer", "admin"]);
    userId = session.user.id;
  } catch (error) {
    if (error instanceof AuthError) return <NotAuthorized />;
    throw error;
  }

  const payouts = await listPayouts({ requestedById: userId });

  return <MyRequestsContent payouts={serialize(payouts)} />;
}

function serialize(
  payouts: Awaited<ReturnType<typeof listPayouts>>
): MyRequestPayout[] {
  return payouts.map((p) => ({
    id: p.id,
    payoutType: p.payoutType,
    amount: String(p.amount),
    status: p.status,
    autoApproved: p.autoApproved,
    reason: p.reason,
    vpRejectReason: p.vpRejectReason,
    presRejectReason: p.presRejectReason,
    paidDate: p.paidDate ? p.paidDate.toISOString() : null,
    member: p.member,
  }));
}

function MyRequestsContent({ payouts }: { payouts: MyRequestPayout[] }) {
  const t = useTranslations("myRequests");

  return (
    <div className="space-y-4">
      <BackLink href="/payouts" />
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <MyRequestsList payouts={payouts} />
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
