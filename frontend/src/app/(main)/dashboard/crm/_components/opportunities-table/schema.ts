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
  /** The plan's current list price — what the next period costs, not what the last one was sold for. */
  planPrice: z.number(),
  planDurationDays: z.number().nullable(),
  planDurationMonths: z.number().nullable(),
  planIsSellable: z.boolean(),
  addons: z.array(
    z.object({
      id: z.number(),
      planId: z.number().nullable(),
      coachId: z.number().nullable(),
      status: z.string(),
      name: z.string(),
      coach: z.string().nullable(),
      price: z.number(),
      planPrice: z.number(),
      paidTotal: z.number(),
      endDate: z.string().nullable(),
      sessionsTotal: z.number().nullable().optional(),
      sessionsRemaining: z.number().nullable().optional(),
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
      /** Distinct from category — `fitness_studio` here is what marks a studio plan. */
      type: z.string(),
      kind: z.enum(["main", "extra"]),
      sessionsCount: z.number().nullable().optional(),
      isUnlimitedSessions: z.boolean().optional(),
      /** Coaches with an active commission rule — the only ones the API accepts for this plan. */
      coaches: z.array(z.object({ id: z.number(), name: z.string(), role: z.string() })),
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
  mainPlanPaidTotal: z.number(),
  collectedPaidTotal: z.number(),
  refundTotal: z.number(),
  value: z.number(),
  balance: z.number(),
  sessionsTotal: z.number().nullable().optional(),
  sessionsRemaining: z.number().nullable().optional(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  canCancelWithRefund: z.boolean(),
  defaultRefundAmount: z.number(),
  cancellationGraceEndsOn: z.string().nullable(),
  reminderDays: z.array(z.number()),
  maxFreezeDays: z.number(),
  minFreezeDays: z.number(),
  freezeRequiresApproval: z.boolean(),
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
