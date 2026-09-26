import { useTranslations } from "next-intl";

import { requireRole, AuthError } from "@/lib/auth-guards";
import { getAllSettingsWithHistory } from "@/lib/settings";
import { SettingsManager } from "@/components/settings/settings-manager";

export default async function SettingsPage() {
  try {
    await requireRole(["admin"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return <NotAuthorized />;
    }
    throw error;
  }

  const settings = await getAllSettingsWithHistory();
  const serialized = settings.map((s) => ({
    key: s.key,
    current: s.current
      ? { value: s.current.value, effectiveFrom: s.current.effectiveFrom.toISOString() }
      : null,
    history: s.history.map((h) => ({
      value: h.value,
      effectiveFrom: h.effectiveFrom.toISOString(),
    })),
  }));

  return <SettingsPageContent settings={serialized} />;
}

function SettingsPageContent({
  settings,
}: {
  settings: Parameters<typeof SettingsManager>[0]["settings"];
}) {
  const t = useTranslations("settingsPage");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <SettingsManager settings={settings} />
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
