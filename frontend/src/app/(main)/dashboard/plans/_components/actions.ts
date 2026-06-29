"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function createPlan(input: FormData): Promise<void> {
  const payload = {
    description: String(input.get("description") || ""),
    duration_days: Number(input.get("duration_days") || 30),
    max_freeze_days: Number(input.get("max_freeze_days") || 0),
    name: String(input.get("name") || ""),
    price: String(input.get("price") || "0"),
    sessions_count: nullableNumber(input.get("sessions_count")),
    type: String(input.get("type") || "monthly"),
  };

  await mutate("/plans", "POST", payload);
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

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}
