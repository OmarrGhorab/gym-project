import z from "zod";

export const membershipPipelineSchema = z.object({
  id: z.string(),
  subscriptionId: z.number(),
  memberId: z.number().nullable(),
  member: z.string().nullable(),
  memberPhone: z.string().nullable(),
  memberQr: z.string().nullable(),
  planId: z.number().nullable(),
  plan: z.string().nullable(),
  addons: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      coach: z.string().nullable(),
      price: z.number(),
      endDate: z.string().nullable(),
    }),
  ),
  planOptions: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      price: z.number(),
      durationDays: z.number(),
      durationMonths: z.number().nullable(),
      category: z.string(),
      kind: z.enum(["main", "extra"]),
    }),
  ),
  coachOptions: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      role: z.string(),
    }),
  ),
  status: z.string(),
  billingStatus: z.string(),
  daysLeft: z.number().nullable(),
  health: z.string(),
  healthReason: z.string(),
  paidTotal: z.number(),
  collectedPaidTotal: z.number(),
  refundTotal: z.number(),
  value: z.number(),
  balance: z.number(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  canCancelWithRefund: z.boolean(),
  defaultRefundAmount: z.number(),
  cancellationGraceEndsOn: z.string().nullable(),
  reminderDays: z.array(z.number()),
  maxFreezeDays: z.number(),
  minFreezeDays: z.number(),
  freeze: z
    .object({
      freezeStart: z.string().nullable(),
      freezeEnd: z.string().nullable(),
      resumedOn: z.string().nullable(),
      plannedDays: z.number().nullable(),
      remainingDaysAtFreeze: z.number().nullable(),
      reason: z.string().nullable(),
    })
    .nullable(),
});

export const membershipPipelineRowsSchema = z.array(membershipPipelineSchema);

export type MembershipPipelineRow = z.infer<typeof membershipPipelineSchema>;
