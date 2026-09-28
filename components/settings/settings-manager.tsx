"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import type { SettingKey } from "@/lib/settings";
import { BOOLEAN_SETTING_KEYS } from "@/lib/setting-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettingEditDialog } from "@/components/settings/setting-edit-dialog";

export type SerializedSettingRow = { value: string; effectiveFrom: string };
export type SerializedSetting = {
  key: SettingKey;
  current: SerializedSettingRow | null;
  history: SerializedSettingRow[];
};

export function SettingsManager({
  settings: initialSettings,
}: {
  settings: SerializedSetting[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const t = useTranslations("settingsPage");
  const format = useFormatter();
  // "true"/"false" rows read as words, numbers stay as figures.
  const display = (key: SettingKey, value: string | undefined) => {
    if (value === undefined) return "—";
    return BOOLEAN_SETTING_KEYS.has(key) ? t(`booleanValues.${value === "true" ? "on" : "off"}`) : value;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {settings.map((setting) => (
        <Card key={setting.key}>
          <CardHeader>
            <CardTitle className="text-base">
              {t(`keys.${setting.key}.label`)}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t(`keys.${setting.key}.description`)}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p
                className={
                  BOOLEAN_SETTING_KEYS.has(setting.key)
                    ? "text-2xl font-semibold"
                    : "text-2xl font-semibold tabular-nums"
                }
              >
                {display(setting.key, setting.current?.value)}
              </p>
              {setting.current && (
                <p className="text-xs text-muted-foreground">
                  {t("effectiveSince", {
                    date: format.dateTime(new Date(setting.current.effectiveFrom), {
                      dateStyle: "medium",
                    }),
                  })}
                </p>
              )}
            </div>

            <SettingEditDialog
              settingKey={setting.key}
              currentValue={setting.current?.value}
              onSaved={(updated) => setSettings(updated)}
            />

            {setting.history.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  {t("history")} ({setting.history.length})
                </summary>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("newValue")}</TableHead>
                      <TableHead>{t("effectiveFrom")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {setting.history.map((row) => (
                      <TableRow key={row.effectiveFrom}>
                        <TableCell className="tabular-nums">
                          {display(setting.key, row.value)}
                        </TableCell>
                        <TableCell>
                          {format.dateTime(new Date(row.effectiveFrom), {
                            dateStyle: "medium",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </details>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
