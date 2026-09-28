"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Pencil, Loader2 } from "lucide-react";

import type { SettingKey } from "@/lib/settings";
import { BOOLEAN_SETTING_KEYS } from "@/lib/setting-types";
import type { SerializedSetting } from "@/components/settings/settings-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

const editSchema = z.object({
  value: z.string().min(1),
  effectiveFrom: z.string().min(1),
});
type EditValues = z.infer<typeof editSchema>;

export function SettingEditDialog({
  settingKey,
  currentValue,
  onSaved,
}: {
  settingKey: SettingKey;
  currentValue?: string;
  onSaved: (settings: SerializedSetting[]) => void;
}) {
  const t = useTranslations("settingsPage");
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isBoolean = BOOLEAN_SETTING_KEYS.has(settingKey);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      value: currentValue ?? "",
      effectiveFrom: todayISODate(),
    },
  });

  function openDialog(next: boolean) {
    setOpen(next);
    if (next) {
      setSubmitError(null);
      reset({ value: currentValue ?? "", effectiveFrom: todayISODate() });
    }
  }

  async function onSubmit(values: EditValues) {
    setSubmitError(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: settingKey,
        value: values.value,
        effectiveFrom: values.effectiveFrom,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const issueMessage = body?.issues?.[0]?.message as string | undefined;
      const serverMessage =
        typeof body?.error === "string" && body.error !== "VALIDATION"
          ? body.error
          : undefined;
      setSubmitError(issueMessage ?? serverMessage ?? t("saveError"));
      return;
    }

    const data = await res.json();
    onSaved(data.settings);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {t("editTitle", { label: t(`keys.${settingKey}.label`) })}
            </DialogTitle>
            <DialogDescription>
              {t(`keys.${settingKey}.description`)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor={`${settingKey}-value`}>{t("newValue")}</Label>
              {isBoolean ? (
                <Controller
                  control={control}
                  name="value"
                  render={({ field }) => (
                    <Select value={field.value || "true"} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger id={`${settingKey}-value`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">{t("booleanValues.on")}</SelectItem>
                        <SelectItem value="false">{t("booleanValues.off")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <Input
                  id={`${settingKey}-value`}
                  inputMode="decimal"
                  {...register("value")}
                />
              )}
              {errors.value && (
                <p className="text-sm text-destructive">
                  {errors.value.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${settingKey}-effectiveFrom`}>
                {t("effectiveFrom")}
              </Label>
              <Input
                id={`${settingKey}-effectiveFrom`}
                type="date"
                {...register("effectiveFrom")}
              />
              <p className="text-xs text-muted-foreground">
                {t("effectiveFromHint")}
              </p>
              {errors.effectiveFrom && (
                <p className="text-sm text-destructive">
                  {errors.effectiveFrom.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
