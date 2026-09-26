import { useTranslations } from "next-intl";

export default function ReportsPage() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">{t("reports")}</h1>
      <p className="text-muted-foreground">{tCommon("comingSoon")}</p>
    </div>
  );
}
