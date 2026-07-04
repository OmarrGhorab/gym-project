import z from "zod";

export const recentCustomersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  plan: z.string().nullable(),
  planEndsAt: z.string().nullable(),
  status: z.string().nullable(),
  billing: z.string(),
  totalPaid: z.string(),
  joined: z.string().nullable(),
});

export type RecentCustomerRow = z.infer<typeof recentCustomersSchema>;
