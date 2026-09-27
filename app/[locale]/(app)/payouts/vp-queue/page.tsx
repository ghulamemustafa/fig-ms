import { useTranslations } from "next-intl";

import { requireRole, AuthError } from "@/lib/auth-guards";
import { listPayouts } from "@/lib/payouts";
import { PayoutQueueList, type QueuePayout } from "@/components/payouts/payout-queue-list";
import { BackLink } from "@/components/app-shell/back-link";

export default async function VpQueuePage() {
  try {
    await requireRole(["vp", "admin"]);
  } catch (error) {
    if (error instanceof AuthError) return <NotAuthorized />;
    throw error;
  }

  const payouts = await listPayouts({ status: "requested" });

  return <VpQueueContent payouts={serialize(payouts)} />;
}

function serialize(
  payouts: Awaited<ReturnType<typeof listPayouts>>
): QueuePayout[] {
  return payouts.map((p) => ({
    id: p.id,
    payoutType: p.payoutType,
    amount: String(p.amount),
    reason: p.reason,
    status: p.status,
    member: p.member,
    requestedBy: p.requestedBy,
    vpDecisionBy: p.vpDecisionBy,
  }));
}

function VpQueueContent({ payouts }: { payouts: QueuePayout[] }) {
  const t = useTranslations("payoutsPage");

  return (
    <div className="space-y-4">
      <BackLink href="/payouts" />
      <h1 className="text-2xl font-semibold tracking-tight">{t("vpQueueTitle")}</h1>
      <PayoutQueueList
        payouts={payouts}
        decisionKind="vp-decision"
      />
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
