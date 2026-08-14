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
  planStartsAt: z.string().nullable(),
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
      plan_id: z.number().nullable().optional(),
      plan_name: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      projected_end_date: z.string().nullable().optional(),
      status: z.string(),
      days_left: z.number().nullable().optional(),
      renewal_health: z.string().nullable().optional(),
      renewal_health_reason: z.string().nullable().optional(),
      sessions_total: z.number().nullable().optional(),
      sessions_remaining: z.number().nullable().optional(),
      cancellation_grace_days: z.number().nullable().optional(),
      discount: z.string().nullable().optional(),
      package_paid_total: z.string().nullable().optional(),
      package_price_paid: z.string().nullable().optional(),
      package_balance: z.string().nullable().optional(),
      price_paid: z.string().nullable().optional(),
      paid_total: z.string().nullable().optional(),
      balance: z.string().nullable().optional(),
      freeze: z
        .object({
          id: z.number().optional(),
          freeze_start: z.string().nullable().optional(),
          freeze_end: z.string().nullable().optional(),
          remaining_days_at_freeze: z.number().nullable().optional(),
          projected_end_date: z.string().nullable().optional(),
          approval_status: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      pending_freeze: z
        .object({
          id: z.number(),
          freeze_start: z.string().nullable().optional(),
          freeze_end: z.string().nullable().optional(),
          planned_days: z.number().nullable().optional(),
          reason: z.string().nullable().optional(),
          approval_status: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
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
