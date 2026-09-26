import { useTranslations } from "next-intl";

import { requireRole, AuthError } from "@/lib/auth-guards";
import { MemberForm } from "@/components/members/member-form";

export default async function NewMemberPage() {
  try {
    await requireRole(["admin", "data_entry"]);
  } catch (error) {
    if (error instanceof AuthError) return <NotAuthorized />;
    throw error;
  }

  return <NewMemberContent />;
}

function NewMemberContent() {
  const t = useTranslations("memberForm");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
      <MemberForm mode="create" />
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
