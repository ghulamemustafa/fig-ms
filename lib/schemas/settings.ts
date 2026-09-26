import { z } from "zod";

import { SETTING_KEYS } from "@/lib/settings";

export const settingKeySchema = z.enum(SETTING_KEYS);

const INTEGER_KEYS = new Set([
  "newMemberMonths",
  "eligibilityMonths",
  "removalMonths",
]);

export const updateSettingSchema = z
  .object({
    key: settingKeySchema,
    value: z.string().min(1),
    effectiveFrom: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    const num = Number(data.value);
    if (Number.isNaN(num)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Must be a number",
      });
      return;
    }
    if (INTEGER_KEYS.has(data.key)) {
      if (!Number.isInteger(num) || num <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Must be a positive whole number",
        });
      }
    } else if (num <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Must be greater than 0",
      });
    }
  });

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
