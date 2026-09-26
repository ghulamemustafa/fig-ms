import { useTranslations } from "next-intl";
import { HandCoins, AlertTriangle } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default function PaymentsPage() {
  const t = useTranslations("paymentsPage");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/payments/collect">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardContent className="flex items-start gap-3 pt-6">
              <HandCoins className="size-8 shrink-0 text-primary" />
              <div>
                <CardTitle className="text-base">{t("collectTitle")}</CardTitle>
                <CardDescription>{t("collectDescription")}</CardDescription>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/payments/defaulters">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertTriangle className="size-8 shrink-0 text-primary" />
              <div>
                <CardTitle className="text-base">{t("defaultersTitle")}</CardTitle>
                <CardDescription>{t("defaultersDescription")}</CardDescription>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
