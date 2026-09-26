import { notFound } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { Pencil } from "lucide-react";

import { getSession } from "@/lib/auth-guards";
import { hasRole } from "@/lib/rbac";
import { getMemberById } from "@/lib/members";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SuccessionDialog } from "@/components/members/succession-dialog";
import { RemovalDialog } from "@/components/members/removal-dialog";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [member, session] = await Promise.all([getMemberById(id), getSession()]);
  if (!member) notFound();

  const role = session?.user?.role;
  const canEdit = hasRole(role, ["admin", "data_entry"]);
  const canSucceed = hasRole(role, ["admin", "data_entry"]) && member.status !== "removed";
  const canRemove = hasRole(role, ["admin"]) && member.status === "active";

  return (
    <MemberDetailContent
      member={member}
      canEdit={canEdit}
      canSucceed={canSucceed}
      canRemove={canRemove}
    />
  );
}

function MemberDetailContent({
  member,
  canEdit,
  canSucceed,
  canRemove,
}: {
  member: NonNullable<Awaited<ReturnType<typeof getMemberById>>>;
  canEdit: boolean;
  canSucceed: boolean;
  canRemove: boolean;
}) {
  const t = useTranslations("memberDetail");
  const tMembers = useTranslations("membersPage");
  const tForm = useTranslations("memberForm");
  const tQueue = useTranslations("payoutQueue");
  const tType = useTranslations("payoutType");
  const tStatus = useTranslations("payoutStatus");
  const format = useFormatter();

  const dateStr = (d: Date) => format.dateTime(d, { dateStyle: "medium" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{member.name}</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {member.serialNo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && member.status !== "deceased" && (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href={`/members/${member.id}/edit`}>
                  <Pencil className="size-4" />
                  {t("editButton")}
                </Link>
              }
            />
          )}
          {canSucceed && member.status !== "deceased" && (
            <SuccessionDialog
              memberId={member.id}
              memberName={member.name}
              dependents={member.dependents.map((d) => ({
                id: d.id,
                name: d.name,
                relation: d.relation,
              }))}
            />
          )}
          {canRemove && (
            <RemovalDialog memberId={member.id} memberName={member.name} />
          )}
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="dependents">{t("tabs.dependents")}</TabsTrigger>
          <TabsTrigger value="payments">{t("tabs.payments")}</TabsTrigger>
          <TabsTrigger value="payouts">{t("tabs.payouts")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={member.status === "active" ? "secondary" : "outline"}>
              {tMembers(`status.${member.status as "active" | "removed" | "deceased"}`)}
            </Badge>
            <Badge variant={member.fundEligible ? "default" : "outline"}>
              {member.fundEligible ? tMembers("eligible") : tMembers("notEligible")}
            </Badge>
            {member.unpaidMonths > 0 && (
              <Badge variant="destructive">
                {t("unpaidMonths")}: {member.unpaidMonths}
              </Badge>
            )}
          </div>

          {member.predecessor && (
            <p className="text-sm text-muted-foreground">
              {t("predecessorOf", { name: member.predecessor.name })} (
              <Link href={`/members/${member.predecessor.id}`} className="underline">
                {member.predecessor.serialNo}
              </Link>
              )
            </p>
          )}
          {member.succeededBy && (
            <p className="text-sm text-muted-foreground">
              {t("succeededByLabel", { name: member.succeededBy.name })} (
              <Link href={`/members/${member.succeededBy.id}`} className="underline">
                {member.succeededBy.serialNo}
              </Link>
              )
            </p>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label={tForm("fields.fatherName")} value={member.fatherName} />
            <DetailField label={tForm("fields.cnic")} value={member.cnic} mono />
            <DetailField label={tForm("fields.mobile")} value={member.mobile} mono />
            <DetailField label={tForm("fields.address")} value={member.address} />
            <DetailField
              label={tForm("fields.maritalStatus")}
              value={tForm(`maritalStatus.${member.maritalStatus as "single" | "married" | "widowed" | "divorced"}`)}
            />
            <DetailField label={tForm("fields.occupation")} value={member.occupation} />
            <DetailField label={tForm("fields.income")} value={String(member.income)} />
            <DetailField label={tForm("fields.dob")} value={dateStr(member.dob)} />
            <DetailField label={t("originalJoinDate")} value={dateStr(member.originalJoinDate)} />
            <DetailField label={t("currentJoinDate")} value={dateStr(member.currentJoinDate)} />
            {member.removedDate && (
              <DetailField label={t("removedDate")} value={dateStr(member.removedDate)} />
            )}
            {member.removedReason && (
              <DetailField label={t("removedReason")} value={member.removedReason} />
            )}
          </dl>
        </TabsContent>

        <TabsContent value="dependents" className="space-y-3">
          {member.dependents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDependents")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {member.dependents.map((dep) => (
                <div key={dep.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{dep.name}</p>
                  <p className="text-muted-foreground">
                    {tForm(`relation.${dep.relation as "spouse" | "son" | "daughter" | "father" | "mother" | "other"}`)} ·{" "}
                    {dateStr(dep.dob)}
                  </p>
                  <p className="text-muted-foreground">{dep.occupation}</p>
                  {dep.notes && <p className="mt-1 text-muted-foreground">{dep.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          {member.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {format.dateTime(p.monthCovered, { month: "long", year: "numeric" })}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {String(p.amount)}
                        {p.wasDoubleFee ? " (2x)" : ""}
                      </TableCell>
                      <TableCell>{dateStr(p.paidDate)}</TableCell>
                      <TableCell className="tabular-nums">{p.receiptNo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payouts">
          {member.payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPayouts")}</p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tQueue("type")}</TableHead>
                    <TableHead>{tQueue("amount")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{tType(p.payoutType as "funeral" | "widow" | "other")}</TableCell>
                      <TableCell className="tabular-nums">{String(p.amount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "paid"
                              ? "default"
                              : p.status.includes("rejected")
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {tStatus(
                            p.status as
                              | "requested"
                              | "vp_approved"
                              | "vp_rejected"
                              | "president_approved"
                              | "president_rejected"
                              | "paid"
                          )}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "tabular-nums" : undefined}>{value}</dd>
    </div>
  );
}
