import { z } from "zod";

export const incomeEntrySchema = z.object({
  date: z.coerce.date(),
  source: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
});
export type IncomeEntryInput = z.infer<typeof incomeEntrySchema>;

export const donationEntrySchema = z.object({
  date: z.coerce.date(),
  donorName: z.string().min(1),
  donorContact: z.string().optional(),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
});
export type DonationEntryInput = z.infer<typeof donationEntrySchema>;

export const expenseEntrySchema = z.object({
  date: z.coerce.date(),
  category: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  approvedBy: z.string().optional(),
});
export type ExpenseEntryInput = z.infer<typeof expenseEntrySchema>;
