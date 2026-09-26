import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { listMembers, type MemberStatus } from "@/lib/members";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { MembersToolbar } from "@/components/members/members-toolbar";
import { MemberList } from "@/components/members/member-list";

const STATUSES: readonly MemberStatus[] = ["active", "removed", "deceased"];

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as MemberStatus)
    ? (sp.status as MemberStatus)
    : undefined;

  const [members, session] = await Promise.all([
    listMembers({ status, search: sp.search }),
    getSession(),
  ]);

  const canCreate = hasRole(session?.user?.role, ["admin", "data_entry"]);

  return (
    <MembersPageContent
      members={members}
      canCreate={canCreate}
    />
  );
}

function MembersPageContent({
  members,
  canCreate,
}: {
  members: Awaited<ReturnType<typeof listMembers>>;
  canCreate: boolean;
}) {
  const t = useTranslations("membersPage");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        {canCreate && (
          <Button
            render={
              <Link href="/members/new">
                <Plus className="size-4" />
                {t("addMember")}
              </Link>
            }
          />
        )}
      </div>

      <MembersToolbar />

      <MemberList
        members={members.map((m) => ({
          id: m.id,
          serialNo: m.serialNo,
          name: m.name,
          cnic: m.cnic,
          mobile: m.mobile,
          status: m.status,
          fundEligible: m.fundEligible,
        }))}
      />
    </div>
  );
}
