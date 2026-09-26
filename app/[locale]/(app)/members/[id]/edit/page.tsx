import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";

import { requireRole, AuthError } from "@/lib/auth-guards";
import { getMemberById } from "@/lib/members";
import { MemberForm, type MemberFormDefaults } from "@/components/members/member-form";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireRole(["admin", "data_entry"]);
  } catch (error) {
    if (error instanceof AuthError) return <NotAuthorized />;
    throw error;
  }

  const { id } = await params;
  const member = await getMemberById(id);
  if (!member) notFound();

  const defaultValues = {
    name: member.name,
    fatherName: member.fatherName,
    cnic: member.cnic,
    serialNo: member.serialNo,
    mobile: member.mobile,
    address: member.address,
    maritalStatus: member.maritalStatus,
    occupation: member.occupation,
    income: Number(member.income),
    dob: toDateInput(member.dob),
    originalJoinDate: toDateInput(member.originalJoinDate),
    dependents: member.dependents.map((d) => ({
      id: d.id,
      name: d.name,
      relation: d.relation,
      maritalStatus: d.maritalStatus,
      dob: toDateInput(d.dob),
      occupation: d.occupation,
      notes: d.notes ?? "",
    })),
  } as unknown as MemberFormDefaults;

  return <EditMemberContent id={id} defaultValues={defaultValues} />;
}

function EditMemberContent({
  id,
  defaultValues,
}: {
  id: string;
  defaultValues: MemberFormDefaults;
}) {
  const t = useTranslations("memberForm");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
      <MemberForm mode="edit" memberId={id} defaultValues={defaultValues} />
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
