"use server";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";
import { revalidateMembershipViews } from "@/lib/revalidate-views";

export type MembershipActionResult =
  | {
      ok: true;
      message: string;
      errors?: Partial<Record<string, string[]>>;
    }
  | {
      ok: false;
      message: string;
      errors?: Partial<Record<string, string[]>>;
    };

const paymentMethodSchema = z.enum(["cash", "card", "bank_transfer"], { error: "Choose a valid payment method." });
const subscriptionIdSchema = z.coerce.number().int().positive("Subscription is required.");
const optionalMoneySchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || value === "" || Number(value) >= 0, "Discount cannot be negative.");
/** Renewal payments may be 0 — a full discount, or a period opened with the balance still due. */
const paymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0, {
      error: "Payment amount cannot be negative.",
    }),
  method: paymentMethodSchema,
  // Money over the price is money, not time. Days are only added when the desk
  // ticks the box that says so.
  extend_days_for_overpayment: z.boolean().optional(),
});
const renewalAddonSchema = z.object({
  plan_id: z.coerce.number().int().positive("Choose a valid extra service."),
  coach_id: z.coerce.number().int().positive("Each extra service needs a coach."),
  discount: optionalMoneySchema,
  payment: paymentSchema,
});
/**
 * Everything past `payment` is an override of what the plan says, sent only
 * when the desk actually changed it. Omitted, the renewal is the plan.
 */
const renewalSchema = z.object({
  discount: optionalMoneySchema,
  payment: paymentSchema,
  addons: z.array(renewalAddonSchema).optional(),
  plan_id: z.coerce.number().int().positive("Choose a valid plan.").optional(),
  coach_id: z.coerce.number().int().positive("Choose a valid coach.").optional(),
  price: optionalMoneySchema,
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid end date.")
    .optional(),
  sessions_total: z.coerce.number().int().min(0, "Sessions cannot be negative.").optional(),
  unlimited_sessions: z.boolean().optional(),
});
const recordPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((value) => Number(value) > 0, "Payment amount must be greater than zero."),
  method: paymentMethodSchema,
  subscription_id: subscriptionIdSchema,
  extend_days_for_overpayment: z.boolean().optional(),
});
const freezeSchema = z
  .object({
    freeze_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid freeze end date."),
    freeze_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid freeze start date."),
    reason: z.string().trim().max(1000, "Reason is too long.").optional(),
  })
  .refine((value) => value.freeze_end >= value.freeze_start, {
    message: "Freeze end cannot be before freeze start.",
    path: ["freeze_end"],
  });
const unfreezeSchema = z.object({
  resume_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid resume date.")
    .optional(),
});

export async function stopMembershipSubscription(id: number): Promise<MembershipActionResult> {
  const parsed = subscriptionIdSchema.safeParse(id);

  if (!parsed.success) {
    return invalidResult("Subscription is required.", parsed.error);
  }

  return mutateSubscription(`/subscriptions/${id}/stop`, "Subscription stopped.");
}

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");
const correctionMoneySchema = z
  .string()
  .trim()
  .refine((value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0, {
    error: "Amount cannot be negative.",
  });
const correctionSessionSchema = z.number().int().min(0).max(100000).nullable();
const correctionSchema = z
  .object({
    cancellation_grace_days: z.number().int().min(0).max(3650),
    discount: correctionMoneySchema,
    end_date: dateOnlySchema,
    price_paid: correctionMoneySchema,
    sessions_remaining: correctionSessionSchema,
    sessions_total: correctionSessionSchema,
    start_date: dateOnlySchema,
  })
  .refine((value) => value.end_date >= value.start_date, {
    message: "End date cannot be before the start date.",
    path: ["end_date"],
  })
  .refine((value) => (value.sessions_total === null) === (value.sessions_remaining === null), {
    message: "Total and remaining sessions must both be blank for unlimited access.",
    path: ["sessions_remaining"],
  })
  .refine(
    (value) =>
      value.sessions_total === null ||
      value.sessions_remaining === null ||
      value.sessions_remaining <= value.sessions_total,
    {
      message: "Sessions remaining cannot be greater than total sessions.",
      path: ["sessions_remaining"],
    },
  );

export type CorrectMembershipSubscriptionInput = {
  cancellation_grace_days: number;
  discount: string;
  end_date: string;
  price_paid: string;
  sessions_remaining: number | null;
  sessions_total: number | null;
  start_date: string;
};

/**
 * Fixes the member-specific values captured when this membership was sold.
 * Never the catalogue plan, lifecycle history, or money already collected:
 * those have dedicated workflows and audit consequences.
 */
export async function correctMembershipSubscription(
  id: number,
  input: CorrectMembershipSubscriptionInput,
): Promise<MembershipActionResult> {
  const parsedId = subscriptionIdSchema.safeParse(id);
  const parsedInput = correctionSchema.safeParse(input);

  if (!parsedId.success) return invalidResult("Subscription is required.", parsedId.error);
  if (!parsedInput.success) return invalidResult("Please fix the highlighted fields.", parsedInput.error);

  return mutateSubscription(`/subscriptions/${parsedId.data}`, "Membership updated.", parsedInput.data, "PATCH");
}

export type CancelMembershipSubscriptionInput = {
  refund_amount?: string;
  refund_scope?: "full_package" | "main_plan";
  method?: "cash" | "card" | "bank_transfer";
  reason?: string;
};

export async function cancelMembershipSubscription(
  id: number,
  input: CancelMembershipSubscriptionInput = {},
): Promise<MembershipActionResult> {
  const parsedId = subscriptionIdSchema.safeParse(id);

  if (!parsedId.success) {
    return invalidResult("Subscription is required.", parsedId.error);
  }

  return mutateSubscription(`/subscriptions/${parsedId.data}/cancel`, "Subscription cancelled with refund.", {
    force: true,
    ...(input.refund_amount !== undefined ? { refund_amount: input.refund_amount } : {}),
    ...(input.refund_scope ? { refund_scope: input.refund_scope } : {}),
    ...(input.method ? { method: input.method } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  });
}

export async function cancelMembershipAddon(
  subscriptionId: number,
  addonId: number,
  input: CancelMembershipSubscriptionInput = {},
): Promise<MembershipActionResult> {
  const parsedSubscriptionId = subscriptionIdSchema.safeParse(subscriptionId);
  const parsedAddonId = subscriptionIdSchema.safeParse(addonId);

  if (!parsedSubscriptionId.success || !parsedAddonId.success) {
    return invalidResult("Subscription and extra service are required.");
  }

  return mutateSubscription(
    `/subscriptions/${parsedSubscriptionId.data}/addons/${parsedAddonId.data}/cancel`,
    "Extra service cancelled with refund.",
    {
      ...(input.refund_amount !== undefined ? { refund_amount: input.refund_amount } : {}),
      ...(input.method ? { method: input.method } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  );
}

export type UnfreezeMembershipSubscriptionInput = {
  resume_on?: string;
};

export async function unfreezeMembershipSubscription(
  id: number,
  input: UnfreezeMembershipSubscriptionInput = {},
): Promise<MembershipActionResult> {
  const parsedId = subscriptionIdSchema.safeParse(id);
  const parsedInput = unfreezeSchema.safeParse(input);

  if (!parsedId.success) return invalidResult("Subscription is required.", parsedId.error);
  if (!parsedInput.success) return invalidResult("Please fix the highlighted unfreeze fields.", parsedInput.error);

  return mutateSubscription(`/subscriptions/${parsedId.data}/unfreeze`, "Subscription unfrozen.", parsedInput.data);
}

export type RenewMembershipSubscriptionInput = {
  discount?: string;
  payment: {
    amount: string;
    method: "cash" | "card" | "bank_transfer";
    extend_days_for_overpayment?: boolean;
  };
  addons?: Array<{
    plan_id: number;
    coach_id: number;
    discount?: string;
    payment: {
      amount: string;
      method: "cash" | "card" | "bank_transfer";
    };
  }>;
  /** Overrides of the plan's own terms, for this period only. */
  plan_id?: number;
  coach_id?: number;
  price?: string;
  end_date?: string;
  sessions_total?: number;
  unlimited_sessions?: boolean;
};

export async function renewMembershipSubscription(
  id: number,
  input: RenewMembershipSubscriptionInput,
): Promise<MembershipActionResult> {
  const parsedId = subscriptionIdSchema.safeParse(id);
  const parsedInput = renewalSchema.safeParse(input);

  if (!parsedId.success) return invalidResult("Subscription is required.", parsedId.error);
  if (!parsedInput.success) return invalidResult("Please fix the highlighted renewal fields.", parsedInput.error);

  return mutateSubscription(`/subscriptions/${parsedId.data}/renew`, "Subscription renewed.", parsedInput.data);
}

export type RecordMembershipPaymentInput = {
  subscription_id: number;
  amount: string;
  method: "cash" | "card" | "bank_transfer";
  extend_days_for_overpayment?: boolean;
};

export async function recordMembershipPayment(input: RecordMembershipPaymentInput): Promise<MembershipActionResult> {
  const parsed = recordPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return invalidResult("Please fix the highlighted payment fields.", parsed.error);
  }

  return mutateSubscription("/payments", "Payment recorded.", parsed.data);
}

export type FreezeMembershipSubscriptionInput = {
  freeze_start: string;
  freeze_end: string;
  reason?: string;
};

export async function freezeMembershipSubscription(
  id: number,
  input: FreezeMembershipSubscriptionInput,
): Promise<MembershipActionResult> {
  const parsedId = subscriptionIdSchema.safeParse(id);
  const parsedInput = freezeSchema.safeParse(input);

  if (!parsedId.success) return invalidResult("Subscription is required.", parsedId.error);
  if (!parsedInput.success) return invalidResult("Please fix the highlighted freeze fields.", parsedInput.error);

  return mutateSubscription(`/subscriptions/${parsedId.data}/freeze`, "Subscription frozen.", parsedInput.data);
}

async function mutateSubscription(
  path: string,
  successMessage: string,
  body?: Record<string, unknown>,
  method: "POST" | "PATCH" = "POST",
): Promise<MembershipActionResult> {
  let resolvedSuccessMessage = successMessage;

  try {
    const result = await serverApiFetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    resolvedSuccessMessage = result.message ?? successMessage;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Action failed.",
      errors: {},
    };
  }

  revalidateMembershipViews();

  return {
    ok: true,
    message: resolvedSuccessMessage,
    errors: {},
  };
}

/** `error` is optional: some guards fail on more than one parse and have no single field to blame. */
function invalidResult(message: string, error?: z.ZodError): MembershipActionResult {
  return {
    ok: false,
    message,
    errors: error ? error.flatten().fieldErrors : {},
  };
}
