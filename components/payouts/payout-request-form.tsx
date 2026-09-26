"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Check, AlertTriangle } from "lucide-react";

import { requestPayoutSchema, PAYOUT_TYPES } from "@/lib/schemas/payout";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MemberSearchSelect,
  type MemberSearchResult,
} from "@/components/payments/member-search-select";

type MemberDetail = MemberSearchResult & {
  fundEligible: boolean;
  eligibilityDetail: { monthsActive: number; eligibilityMonths: number };
};

export function PayoutRequestForm() {
  const t = useTranslations("payoutRequest");
  const tType = useTranslations("payoutType");
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(requestPayoutSchema),
    defaultValues: {
      memberId: "",
      payoutType: "other" as (typeof PAYOUT_TYPES)[number],
      amount: 0,
      reason: "",
    },
  });

  async function selectMember(m: MemberSearchResult) {
    setSubmitError(null);
    setLoadingMember(true);
    const res = await fetch(`/api/members/${m.id}`);
    const data = await res.json();
    const detail: MemberDetail = {
      id: data.member.id,
      name: data.member.name,
      serialNo: data.member.serialNo,
      cnic: data.member.cnic,
      mobile: data.member.mobile,
      status: data.member.status,
      fundEligible: data.member.fundEligible,
      eligibilityDetail: data.member.eligibilityDetail,
    };
    setMember(detail);
    reset({
      memberId: detail.id,
      payoutType: detail.status === "deceased" ? "funeral" : "other",
      amount: 0,
      reason: "",
    });
    setLoadingMember(false);
  }

  function changeMember() {
    setMember(null);
    setSuccess(false);
    reset({ memberId: "", payoutType: "other", amount: 0, reason: "" });
  }

  async function onSubmit(values: {
    memberId: string;
    payoutType: string;
    amount: number;
    reason?: string;
  }) {
    setSubmitError(null);
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setSubmitError(body?.message ?? t("errors.generic"));
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert>
            <Check className="size-4" />
            <AlertDescription>{t("success")}</AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={changeMember}>{t("requestAnother")}</Button>
            {member && (
              <Button
                variant="outline"
                render={<Link href={`/members/${member.id}`}>View member</Link>}
              />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          {member ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {member.serialNo} · {member.cnic}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={changeMember}>
                {t("changeMember")}
              </Button>
            </div>
          ) : (
            <MemberSearchSelect onSelect={selectMember} />
          )}
        </CardContent>
      </Card>

      {member && !loadingMember && !member.fundEligible && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("notEligibleTitle")}</AlertTitle>
          <AlertDescription>
            {t("notEligibleBody", {
              monthsActive: member.eligibilityDetail.monthsActive,
              eligibilityMonths: member.eligibilityDetail.eligibilityMonths,
            })}
          </AlertDescription>
        </Alert>
      )}

      {member && member.fundEligible && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              {member.status === "deceased" && (
                <Alert>
                  <AlertDescription>{t("deceasedHint")}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label>{t("payoutTypeLabel")}</Label>
                <Controller
                  control={control}
                  name="payoutType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYOUT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {tType(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("amountLabel")}</Label>
                <Input type="number" min="1" step="1" {...register("amount")} />
                {errors.amount && (
                  <p className="text-sm text-destructive">
                    {errors.amount.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>{t("reasonLabel")}</Label>
                <Textarea {...register("reason")} />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
