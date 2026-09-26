import { z } from "zod";

export const PAYOUT_TYPES = ["funeral", "widow", "other"] as const;
export type PayoutType = (typeof PAYOUT_TYPES)[number];

export const requestPayoutSchema = z.object({
  memberId: z.string().min(1),
  payoutType: z.enum(PAYOUT_TYPES),
  amount: z.coerce.number().positive(),
  reason: z.string().optional(),
});
export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

export const payoutDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "reject" && !data.reason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A reason is required to reject.",
      });
    }
  });
export type PayoutDecisionInput = z.infer<typeof payoutDecisionSchema>;

export const markPaidSchema = z.object({
  paidDate: z.coerce.date().optional(),
});
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
