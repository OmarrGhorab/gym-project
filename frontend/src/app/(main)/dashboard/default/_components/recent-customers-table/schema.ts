import z from "zod";

export const recentCustomersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  national_id: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  attendance_code: z.string().nullable().optional(),
  attendance_qr: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  plan: z.string().nullable(),
  planEndsAt: z.string().nullable(),
  status: z.string().nullable(),
  billing: z.string(),
  totalPaid: z.string(),
  joined: z.string().nullable(),
  notes: z.string().nullable().optional(),
  has_photo: z.boolean().optional(),
  updated_at: z.string().nullable().optional(),
  latest_subscription: z
    .object({
      id: z.number(),
      plan_name: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      status: z.string(),
      package_paid_total: z.string().nullable().optional(),
      package_price_paid: z.string().nullable().optional(),
      package_balance: z.string().nullable().optional(),
      price_paid: z.string().nullable().optional(),
      paid_total: z.string().nullable().optional(),
      balance: z.string().nullable().optional(),
      addons: z
        .array(
          z.object({
            id: z.number(),
            status: z.string().optional(),
            end_date: z.string().nullable(),
            price_paid: z.string().optional(),
            paid_total: z.string().optional(),
            plan: z
              .object({
                id: z.number(),
                name: z.string().nullable(),
              })
              .optional(),
          }),
        )
        .optional(),
    })
    .nullable()
    .optional(),
  due: z
    .object({
      subscription_id: z.number(),
      member_id: z.number().nullable(),
      member_name: z.string().nullable(),
      subscription_status: z.string(),
      end_date: z.string().nullable(),
      balance: z.string(),
      paid_total: z.string(),
      price_paid: z.string(),
    })
    .nullable()
    .optional(),
});

export type RecentCustomerRow = z.infer<typeof recentCustomersSchema>;
