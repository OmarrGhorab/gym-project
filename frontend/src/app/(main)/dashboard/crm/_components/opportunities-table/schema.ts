import z from "zod";

export const membershipPipelineSchema = z.object({
  id: z.string(),
  subscriptionId: z.number(),
  memberId: z.number().nullable(),
  member: z.string(),
  plan: z.string(),
  status: z.string(),
  daysLeft: z.number(),
  health: z.string(),
  healthReason: z.string(),
  value: z.number(),
  balance: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  maxFreezeDays: z.number(),
});

export const membershipPipelineRowsSchema = z.array(membershipPipelineSchema);

export type MembershipPipelineRow = z.infer<typeof membershipPipelineSchema>;
