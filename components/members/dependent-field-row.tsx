"use client";

import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";
import { X } from "lucide-react";

import { DEPENDENT_RELATIONS, MARITAL_STATUSES } from "@/lib/schemas/member";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function DependentFieldRow({
  index,
  register,
  control,
  errors,
  onRemove,
}: {
  index: number;
  register: any;
  control: any;
  errors: any;
  onRemove: () => void;
}) {
  const t = useTranslations("memberForm");
  const depErrors = errors?.dependents?.[index];

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-(--shadow-soft)">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {t("sectionDependents")} #{index + 1}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={t("removeDependent")}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("dependentFields.name")}</Label>
          <Input {...register(`dependents.${index}.name` as const)} />
          {depErrors?.name && (
            <p className="text-sm text-destructive">
              {depErrors.name.message as string}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t("dependentFields.relation")}</Label>
          <Controller
            control={control}
            name={`dependents.${index}.relation` as const}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPENDENT_RELATIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`relation.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("dependentFields.maritalStatus")}</Label>
          <Controller
            control={control}
            name={`dependents.${index}.maritalStatus` as const}
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
        </div>

        <div className="space-y-1.5">
          <Label>{t("dependentFields.dob")}</Label>
          <Input type="date" {...register(`dependents.${index}.dob` as const)} />
          {depErrors?.dob && (
            <p className="text-sm text-destructive">
              {depErrors.dob.message as string}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t("dependentFields.occupation")}</Label>
          <Input {...register(`dependents.${index}.occupation` as const)} />
          {depErrors?.occupation && (
            <p className="text-sm text-destructive">
              {depErrors.occupation.message as string}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("dependentFields.notes")}</Label>
          <Textarea {...register(`dependents.${index}.notes` as const)} />
        </div>
      </div>
    </div>
  );
}
