"use client";

import { useState } from "react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus, Loader2 } from "lucide-react";
import type { z } from "zod";

import { createMemberSchema, MARITAL_STATUSES } from "@/lib/schemas/member";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DependentFieldRow } from "@/components/members/dependent-field-row";

type FormInput = z.input<typeof createMemberSchema>;
type FormOutput = z.output<typeof createMemberSchema>;

export type MemberFormDefaults = Partial<FormInput> & { id?: string };

export function MemberForm({
  mode,
  memberId,
  defaultValues,
}: {
  mode: "create" | "edit";
  memberId?: string;
  defaultValues?: MemberFormDefaults;
}) {
  const t = useTranslations("memberForm");
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      name: "",
      fatherName: "",
      cnic: "",
      serialNo: "",
      mobile: "",
      address: "",
      maritalStatus: "married",
      occupation: "",
      income: 0,
      dob: undefined,
      originalJoinDate: today,
      dependents: [],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "dependents" });

  async function onSubmit(values: FormOutput) {
    setSubmitError(null);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { originalJoinDate: _originalJoinDate, ...editableFields } = values;
    const payload = mode === "create" ? values : editableFields;

    const url = mode === "create" ? "/api/members" : `/api/members/${memberId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (body?.error === "DUPLICATE" && (body.field === "cnic" || body.field === "serialNo")) {
        setError(body.field, {
          message: t(`errors.${body.field === "cnic" ? "cnicTaken" : "serialTaken"}`),
        });
        return;
      }
      const issueMessage = body?.issues?.[0]?.message as string | undefined;
      setSubmitError(issueMessage ?? t("errors.generic"));
      return;
    }

    const data = await res.json();
    const resultId = mode === "create" ? data.member.id : memberId;
    router.push(`/members/${resultId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("sectionProfile")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.name")} error={errors.name?.message}>
            <Input {...register("name")} />
          </Field>

          <Field label={t("fields.fatherName")} error={errors.fatherName?.message}>
            <Input {...register("fatherName")} />
          </Field>

          <Field
            label={t("fields.cnic")}
            hint={t("fields.cnicHint")}
            error={errors.cnic?.message}
          >
            <Input placeholder="1234512345671" {...register("cnic")} />
          </Field>

          <Field label={t("fields.serialNo")} error={errors.serialNo?.message}>
            <Input placeholder="FIC-0001" {...register("serialNo")} />
          </Field>

          <Field label={t("fields.mobile")} error={errors.mobile?.message}>
            <Input {...register("mobile")} />
          </Field>

          <Field label={t("fields.maritalStatus")} error={errors.maritalStatus?.message}>
            <Controller
              control={control}
              name="maritalStatus"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARITAL_STATUSES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`maritalStatus.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label={t("fields.occupation")} error={errors.occupation?.message}>
            <Input {...register("occupation")} />
          </Field>

          <Field label={t("fields.income")} error={errors.income?.message}>
            <Input type="number" step="1" min="0" {...register("income")} />
          </Field>

          <Field label={t("fields.dob")} error={errors.dob?.message}>
            <Input type="date" {...register("dob")} />
          </Field>

          {mode === "create" && (
            <Field
              label={t("fields.originalJoinDate")}
              error={errors.originalJoinDate?.message}
            >
              <Input type="date" {...register("originalJoinDate")} />
            </Field>
          )}

          <Field
            label={t("fields.address")}
            error={errors.address?.message}
            className="sm:col-span-2"
          >
            <Textarea {...register("address")} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("sectionDependents")}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                name: "",
                relation: "son",
                maritalStatus: "single",
                dob: undefined,
                occupation: "",
                notes: "",
              })
            }
          >
            <Plus className="size-4" />
            {t("addDependent")}
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noDependents")}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <DependentFieldRow
              key={field.id}
              index={index}
              register={register}
              control={control}
              errors={errors}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
