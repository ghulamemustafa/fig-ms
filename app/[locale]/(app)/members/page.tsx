import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { countMembers, listMembers, type MemberStatus } from "@/lib/members";
import { pageCountOf, resolvePage, resolvePageSize } from "@/lib/pagination";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { MembersToolbar } from "@/components/members/members-toolbar";
import { MemberList } from "@/components/members/member-list";

const STATUSES: readonly MemberStatus[] = ["active", "removed", "deceased"];

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as MemberStatus)
    ? (sp.status as MemberStatus)
    : undefined;
  const filters = { status, search: sp.search };
  const pageSize = resolvePageSize(sp.pageSize);

  const [total, session] = await Promise.all([countMembers(filters), getSession()]);

  // Clamp so a hand-edited ?page= never lands on an empty list.
  const page = resolvePage(sp.page, pageCountOf(total, pageSize));

  const members = await listMembers({ ...filters, page, pageSize });

  const canCreate = hasRole(session?.user?.role, ["admin", "data_entry", "treasurer"]);

  return (
    <MembersPageContent
      members={members}
      canCreate={canCreate}
      page={page}
      pageSize={pageSize}
      total={total}
    />
  );
}

function MembersPageContent({
  members,
  canCreate,
  page,
  pageSize,
  total,
}: {
  members: Awaited<ReturnType<typeof listMembers>>;
  canCreate: boolean;
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = useTranslations("membersPage");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
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
        pagination={{ page, pageSize, total }}
      />
    </div>
  );
}
