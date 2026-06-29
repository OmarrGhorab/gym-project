"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type PlanActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function createPlan(input: FormData): Promise<PlanActionResult> {
  const payload = {
    description: String(input.get("description") || ""),
    duration_days: Number(input.get("duration_days") || 30),
    max_freeze_days: Number(input.get("max_freeze_days") || 0),
    name: String(input.get("name") || ""),
    price: String(input.get("price") || "0"),
    sessions_count: nullableNumber(input.get("sessions_count")),
    type: String(input.get("type") || "monthly"),
  };

  return mutate("/plans", "POST", payload, "Plan created.");
}

export async function togglePlan(input: FormData): Promise<PlanActionResult> {
  return mutate(`/plans/${Number(input.get("id"))}/toggle`, "PATCH", undefined, "Plan status updated.");
}

export async function deletePlan(input: FormData): Promise<PlanActionResult> {
  return mutate(`/plans/${Number(input.get("id"))}`, "DELETE", undefined, "Plan deleted.");
}

async function mutate(path: string, method: string, body: Record<string, unknown> | undefined, success: string) {
  try {
    await serverApiFetch(path, {
      ...(body
        ? {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }
        : {}),
      method,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Plan action failed." };
  }

  revalidatePath("/dashboard/plans");
  revalidatePath("/dashboard/crm");

  return { ok: true, message: success };
}

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}
