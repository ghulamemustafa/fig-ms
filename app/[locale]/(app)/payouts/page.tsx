import { useTranslations } from "next-intl";
import { HandCoins, ShieldCheck, Landmark, ClipboardList } from "lucide-react";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default async function PayoutsPage() {
  const session = await getSession();
  const role = session?.user?.role;

  const canRequest = hasRole(role, ["treasurer", "admin"]);
  const canVp = hasRole(role, ["vp", "admin"]);
  const canPresident = hasRole(role, ["president", "admin"]);

  return (
    <PayoutsPageContent
      canRequest={canRequest}
      canVp={canVp}
      canPresident={canPresident}
    />
  );
}

function PayoutsPageContent({
  canRequest,
  canVp,
  canPresident,
}: {
  canRequest: boolean;
  canVp: boolean;
  canPresident: boolean;
}) {
  const t = useTranslations("payoutsPage");
  const noAccess = !canRequest && !canVp && !canPresident;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      {noAccess && <p className="text-sm text-muted-foreground">{t("noAccess")}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {canRequest && (
          <Link href="/payouts/request">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardContent className="flex items-start gap-3 pt-6">
                <HandCoins className="size-8 shrink-0 text-primary" />
                <div>
                  <CardTitle className="text-base">{t("requestTitle")}</CardTitle>
                  <CardDescription>{t("requestDescription")}</CardDescription>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {canVp && (
          <Link href="/payouts/vp-queue">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardContent className="flex items-start gap-3 pt-6">
                <ShieldCheck className="size-8 shrink-0 text-primary" />
                <div>
                  <CardTitle className="text-base">{t("vpQueueTitle")}</CardTitle>
                  <CardDescription>{t("vpQueueDescription")}</CardDescription>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {canPresident && (
          <Link href="/payouts/president-queue">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardContent className="flex items-start gap-3 pt-6">
                <Landmark className="size-8 shrink-0 text-primary" />
                <div>
                  <CardTitle className="text-base">{t("presidentQueueTitle")}</CardTitle>
                  <CardDescription>{t("presidentQueueDescription")}</CardDescription>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {canRequest && (
          <Link href="/payouts/my-requests">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardContent className="flex items-start gap-3 pt-6">
                <ClipboardList className="size-8 shrink-0 text-primary" />
                <div>
                  <CardTitle className="text-base">{t("myRequestsTitle")}</CardTitle>
                  <CardDescription>{t("myRequestsDescription")}</CardDescription>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
