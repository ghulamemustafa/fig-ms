import { z } from "zod";

export const recordPaymentsSchema = z.object({
  memberId: z.string().min(1),
  months: z.array(z.coerce.date()).min(1),
  confirmReactivation: z.boolean().optional(),
});
export type RecordPaymentsInput = z.infer<typeof recordPaymentsSchema>;
