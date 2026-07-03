"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

const planInputSchema = z
  .object({
    access_ends_at: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.string().nullable(),
    ),
    access_starts_at: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.string().nullable(),
    ),
    category: z.enum(["gym_access", "personal_training", "classes", "nutrition", "recovery"], {
      error: "Plan category is required.",
    }),
    description: z.string().trim().max(5000).optional(),
    duration_days: z.coerce.number().int().min(1, "Duration days must be at least 1."),
    freeze_requires_approval: z.preprocess(
      (value) => value === "on" || value === true,
      z.boolean().default(false),
    ),
    is_unlimited_sessions: z.preprocess(
      (value) => value === "on" || value === true,
      z.boolean().default(false),
    ),
    max_freeze_days: z.coerce.number().int().min(0, "Max freeze days cannot be negative."),
    min_freeze_days: z.coerce.number().int().min(0, "Min freeze days cannot be negative."),
    name: z.string().trim().min(1, "Plan name is required.").max(150),
    price: z.coerce.number().min(0, "Price cannot be negative."),
    sessions_count: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.coerce.number().int().min(1, "Sessions count must be at least 1.").nullable(),
    ),
    type: z.enum(["membership", "offer"], {
      error: "Plan type must be Membership or Offer.",
    }),
    valid_from: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.string().nullable(),
    ),
    valid_to: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.string().nullable(),
    ),
  })
  .refine((value) => value.max_freeze_days <= value.duration_days, {
    message: "Max freeze days cannot be greater than duration days.",
    path: ["max_freeze_days"],
  })
  .refine((value) => value.min_freeze_days <= value.max_freeze_days, {
    message: "Min freeze days cannot be greater than max freeze days.",
    path: ["min_freeze_days"],
  })
  .refine(
    (value) => {
      if (value.valid_from && value.valid_to) {
        return new Date(value.valid_to) >= new Date(value.valid_from);
      }
      return true;
    },
    {
      message: "Valid to must be on or after valid from.",
      path: ["valid_to"],
    },
  )
  .refine(
    (value) => {
      if (value.access_starts_at && value.access_ends_at) {
        return value.access_ends_at > value.access_starts_at;
      }
      return true;
    },
    {
      message: "Access end must be after access start.",
      path: ["access_ends_at"],
    },
  );

export async function createPlan(input: FormData): Promise<void> {
  const parsed = planInputSchema.safeParse({
    access_ends_at: input.get("access_ends_at"),
    access_starts_at: input.get("access_starts_at"),
    category: input.get("category"),
    description: input.get("description"),
    duration_days: input.get("duration_days"),
    freeze_requires_approval: input.get("freeze_requires_approval"),
    is_unlimited_sessions: input.get("is_unlimited_sessions"),
    max_freeze_days: input.get("max_freeze_days"),
    min_freeze_days: input.get("min_freeze_days"),
    name: input.get("name"),
    price: input.get("price"),
    sessions_count: input.get("sessions_count"),
    type: input.get("type"),
    valid_from: input.get("valid_from"),
    valid_to: input.get("valid_to"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid plan input.");
  }

  await mutate("/plans", "POST", {
    ...parsed.data,
    description: parsed.data.description ?? "",
    price: String(parsed.data.price),
  });
}

export async function togglePlan(input: FormData): Promise<void> {
  await mutate(`/plans/${Number(input.get("id"))}/toggle`, "PATCH");
}

export async function deletePlan(input: FormData): Promise<void> {
  await mutate(`/plans/${Number(input.get("id"))}`, "DELETE");
}

async function mutate(path: string, method: string, body?: Record<string, unknown>) {
  await serverApiFetch(path, {
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
    method,
  });

  revalidatePath("/dashboard/plans");
  revalidatePath("/dashboard/crm");
}
