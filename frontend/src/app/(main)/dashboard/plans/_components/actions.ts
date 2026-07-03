"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

const planInputSchema = z
  .object({
    description: z.string().trim().max(5000).optional(),
    duration_days: z.coerce.number().int().min(1, "Duration days must be at least 1."),
    max_freeze_days: z.coerce.number().int().min(0, "Max freeze days cannot be negative."),
    name: z.string().trim().min(1, "Plan name is required.").max(150),
    price: z.coerce.number().min(0, "Price cannot be negative."),
    sessions_count: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.coerce.number().int().min(1, "Sessions count must be at least 1.").nullable(),
    ),
    type: z.enum(["membership", "offer"], {
      error: "Plan type must be Membership or Offer.",
    }),
  })
  .refine((value) => value.max_freeze_days <= value.duration_days, {
    message: "Max freeze days cannot be greater than duration days.",
    path: ["max_freeze_days"],
  });

export async function createPlan(input: FormData): Promise<void> {
  const parsed = planInputSchema.safeParse({
    description: input.get("description"),
    duration_days: input.get("duration_days"),
    max_freeze_days: input.get("max_freeze_days"),
    name: input.get("name"),
    price: input.get("price"),
    sessions_count: input.get("sessions_count"),
    type: input.get("type"),
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
