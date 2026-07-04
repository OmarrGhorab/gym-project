import z from "zod";

export const membershipPipelineSchema = z.object({
  id: z.string(),
  subscriptionId: z.number(),
  memberId: z.number().nullable(),
  member: z.string().nullable(),
  plan: z.string().nullable(),
  status: z.string(),
  billingStatus: z.string(),
  daysLeft: z.number().nullable(),
  health: z.string(),
  healthReason: z.string(),
  paidTotal: z.number(),
  value: z.number(),
  balance: z.number(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  maxFreezeDays: z.number(),
});

export const membershipPipelineRowsSchema = z.array(membershipPipelineSchema);

export type MembershipPipelineRow = z.infer<typeof membershipPipelineSchema>;
