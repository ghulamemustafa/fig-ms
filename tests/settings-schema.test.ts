import { describe, expect, it } from "vitest";

import { updateSettingSchema } from "@/lib/schemas/settings";

describe("updateSettingSchema", () => {
  it("accepts true/false for the payout approval setting", () => {
    expect(updateSettingSchema.safeParse({ key: "requirePayoutApproval", value: "true" }).success).toBe(true);
    expect(updateSettingSchema.safeParse({ key: "requirePayoutApproval", value: "false" }).success).toBe(true);
  });

  it("rejects anything else for the payout approval setting", () => {
    for (const value of ["yes", "1", "0", "TRUE", ""]) {
      expect(updateSettingSchema.safeParse({ key: "requirePayoutApproval", value }).success).toBe(false);
    }
  });

  it("still requires a positive number for numeric settings", () => {
    expect(updateSettingSchema.safeParse({ key: "baseFee", value: "600" }).success).toBe(true);
    expect(updateSettingSchema.safeParse({ key: "baseFee", value: "true" }).success).toBe(false);
    expect(updateSettingSchema.safeParse({ key: "eligibilityMonths", value: "2.5" }).success).toBe(false);
  });
});
