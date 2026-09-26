"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, HeartCrack } from "lucide-react";
import type { z } from "zod";

import { succeedMemberSchema } from "@/lib/schemas/member";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormInput = z.input<typeof succeedMemberSchema>;
type FormOutput = z.output<typeof succeedMemberSchema>;

export function SuccessionDialog({
  memberId,
  memberName,
  dependents,
}: {
  memberId: string;
  memberName: string;
  dependents: { id: string; name: string; relation: string }[];
}) {
  const t = useTranslations("succession");
  const tForm = useTranslations("memberForm");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ successorName: string } | null>(null);
  const [mode, setMode] = useState<"promoteDependent" | "newMember">(
    dependents.length > 0 ? "promoteDependent" : "newMember"
  );

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(succeedMemberSchema),
    defaultValues: {
      mode,
      removedDate: today,
      dependentId: dependents[0]?.id,
      fatherName: memberName,
      cnic: "",
      serialNo: "",
      mobile: "",
      address: "",
      income: 0,
      name: "",
      maritalStatus: "single",
      occupation: "",
      dob: undefined,
      dependents: [],
    } as FormInput,
  });

  function openDialog(next: boolean) {
    setOpen(next);
    if (next) {
      setSubmitError(null);
      setResult(null);
      reset();
    }
  }

  async function onSubmit(values: FormOutput) {
    setSubmitError(null);
    const res = await fetch(`/api/members/${memberId}/succeed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setSubmitError(body?.error ?? tForm("errors.generic"));
      return;
    }

    const data = await res.json();
    setResult({ successorName: data.successor.name });
  }

  function handleDone() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <HeartCrack className="size-4" />
            {t("title")}
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("successTitle")}</DialogTitle>
            </DialogHeader>
            <Alert>
              <AlertTitle>{t("successTitle")}</AlertTitle>
              <AlertDescription>
                {t("successBody", {
                  deceasedName: memberName,
                  successorName: result.successorName,
                })}
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={handleDone}>{t("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>
                {t("description", { name: memberName })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label>{t("removedDateLabel")}</Label>
                <Input type="date" {...register("removedDate")} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("modeLabel")}</Label>
                <Controller
                  control={control}
                  name="mode"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setMode(value as typeof mode);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dependents.length > 0 && (
                          <SelectItem value="promoteDependent">
                            {t("modePromoteDependent")}
                          </SelectItem>
                        )}
                        <SelectItem value="newMember">
                          {t("modeNewMember")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {mode === "promoteDependent" && dependents.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("noDependentsAvailable")}
                  </p>
                )}
              </div>

              {mode === "promoteDependent" && dependents.length > 0 && (
                <div className="space-y-1.5">
                  <Label>{t("selectDependentLabel")}</Label>
                  <Controller
                    control={control}
                    name="dependentId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dependents.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} ({d.relation})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}

              {mode === "newMember" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{tForm("fields.name")}</Label>
                    <Input {...register("name")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tForm("fields.dob")}</Label>
                    <Input type="date" {...register("dob")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tForm("fields.occupation")}</Label>
                    <Input {...register("occupation")} />
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{tForm("fields.fatherName")}</Label>
                  <Input {...register("fatherName")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tForm("fields.cnic")}</Label>
                  <Input placeholder="12345-1234567-1" {...register("cnic")} />
                  {errors.cnic?.message && (
                    <p className="text-sm text-destructive">
                      {errors.cnic.message as string}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{tForm("fields.serialNo")}</Label>
                  <Input {...register("serialNo")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tForm("fields.mobile")}</Label>
                  <Input {...register("mobile")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{tForm("fields.address")}</Label>
                  <Input {...register("address")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{tForm("fields.income")}</Label>
                  <Input type="number" min="0" {...register("income")} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isSubmitting ? t("saving") : t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
