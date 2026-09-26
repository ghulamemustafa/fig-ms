import { z } from "zod";

export const MARITAL_STATUSES = ["single", "married", "widowed", "divorced"] as const;
export const DEPENDENT_RELATIONS = [
  "spouse",
  "son",
  "daughter",
  "father",
  "mother",
  "other",
] as const;

const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export const dependentSchema = z.object({
  id: z.string().optional(), // present when editing an existing dependent row
  name: z.string().min(1),
  relation: z.enum(DEPENDENT_RELATIONS),
  maritalStatus: z.enum(MARITAL_STATUSES),
  dob: z.coerce.date(),
  occupation: z.string().min(1),
  notes: z.string().optional(),
});
export type DependentInput = z.infer<typeof dependentSchema>;

const memberFieldsSchema = z.object({
  name: z.string().min(1),
  fatherName: z.string().min(1),
  cnic: z.string().regex(cnicRegex, "Format: 12345-1234567-1"),
  serialNo: z.string().min(1),
  mobile: z
    .string()
    .min(1)
    .refine((v) => digitsOnly(v).length >= 10, "Enter a valid mobile number"),
  address: z.string().min(1),
  maritalStatus: z.enum(MARITAL_STATUSES),
  occupation: z.string().min(1),
  income: z.coerce.number().nonnegative(),
  dob: z.coerce.date(),
  dependents: z.array(dependentSchema).default([]),
});

/** Registration: originalJoinDate is editable (for onboarding pre-existing paper records); currentJoinDate is always set equal to it server-side for a fresh join. */
export const createMemberSchema = memberFieldsSchema.extend({
  originalJoinDate: z.coerce.date(),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

/** Edit: everything except status/join-dates/succession fields, which have their own dedicated flows. */
export const updateMemberSchema = memberFieldsSchema;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const removeMemberSchema = z.object({
  reason: z.string().min(1),
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

const successorCommonSchema = z.object({
  removedDate: z.coerce.date().optional(), // defaults to now server-side
});

export const succeedMemberSchema = z.discriminatedUnion("mode", [
  successorCommonSchema.extend({
    mode: z.literal("promoteDependent"),
    dependentId: z.string().min(1),
    // Fields the Dependent model doesn't carry, needed to complete a Member row.
    cnic: z.string().regex(cnicRegex, "Format: 12345-1234567-1"),
    serialNo: z.string().min(1),
    mobile: z
      .string()
      .min(1)
      .refine((v) => digitsOnly(v).length >= 10, "Enter a valid mobile number"),
    address: z.string().min(1),
    income: z.coerce.number().nonnegative(),
    fatherName: z.string().min(1),
  }),
  successorCommonSchema.extend({
    mode: z.literal("newMember"),
    ...memberFieldsSchema.shape,
  }),
]);
export type SucceedMemberInput = z.infer<typeof succeedMemberSchema>;
