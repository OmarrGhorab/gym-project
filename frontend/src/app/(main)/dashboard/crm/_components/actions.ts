"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

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
const paymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((value) => Number(value) > 0, "Payment amount must be greater than zero."),
  method: paymentMethodSchema,
});
const renewalSchema = z.object({
  discount: optionalMoneySchema,
  payment: paymentSchema,
});
const recordPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((value) => Number(value) > 0, "Payment amount must be greater than zero."),
  method: paymentMethodSchema,
  subscription_id: subscriptionIdSchema,
});
const changePlanSchema = z.object({
  discount: optionalMoneySchema,
  payment: paymentSchema.extend({
    amount: z
      .string()
      .trim()
      .refine((value) => Number(value) >= 0, "Payment amount cannot be negative."),
  }),
  plan_id: z.coerce.number().int().positive("Plan is required."),
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
  };
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
};

export async function recordMembershipPayment(input: RecordMembershipPaymentInput): Promise<MembershipActionResult> {
  const parsed = recordPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return invalidResult("Please fix the highlighted payment fields.", parsed.error);
  }

  return mutateSubscription("/payments", "Payment recorded.", parsed.data);
}

export type ChangeMembershipPlanInput = {
  plan_id: number;
  discount?: string;
  payment: {
    amount: string;
    method: "cash" | "card" | "bank_transfer";
  };
};

export async function changeMembershipPlan(
  id: number,
  input: ChangeMembershipPlanInput,
  mode: "upgrade" | "renew" = "upgrade",
): Promise<MembershipActionResult> {
  const parsedId = subscriptionIdSchema.safeParse(id);
  const parsedInput = changePlanSchema.safeParse(input);

  if (!parsedId.success) return invalidResult("Subscription is required.", parsedId.error);
  if (!parsedInput.success) return invalidResult("Please fix the highlighted plan fields.", parsedInput.error);

  return mutateSubscription(`/subscriptions/${parsedId.data}/${mode}`, "Plan changed.", parsedInput.data);
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
): Promise<MembershipActionResult> {
  try {
    await serverApiFetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Action failed.",
      errors: {},
    };
  }

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/default");

  return {
    ok: true,
    message: successMessage,
    errors: {},
  };
}

function invalidResult(message: string, error: z.ZodError): MembershipActionResult {
  return {
    ok: false,
    message,
    errors: error.flatten().fieldErrors,
  };
}
