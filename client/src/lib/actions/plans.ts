"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";
import type { AppLocale } from "@/i18n/routing";
import type { Plan } from "@/lib/api/dashboard";

export type PlanFormData = {
  name: string;
  description?: string;
  price: string;
  duration_days: number;
  sessions_count?: number | null;
  type: "membership" | "offer";
  is_active?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  max_freeze_days?: number;
};

class PlanActionError extends Error {
  details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "PlanActionError";
    this.details = details;
  }
}

async function plansFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const details =
      (payload.error as { details?: Record<string, string[]> } | undefined)
        ?.details ?? undefined;
    const errorMessage =
      ((payload.error as { message?: string })?.message) ??
      (payload.message as string) ??
      response.statusText;

    const error = new PlanActionError(errorMessage, details);
    if (details && Object.keys(details).length > 0) {
      error.message = JSON.stringify({
        message: errorMessage,
        details,
      });
    }

    throw error;
  }

  return payload;
}

export async function createPlan(
  data: PlanFormData,
  locale: AppLocale
): Promise<Plan> {
  const payload = await plansFetch("/plans", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidatePlans(locale);

  return payload.data as Plan;
}

export async function updatePlan(
  id: number,
  data: PlanFormData,
  locale: AppLocale
): Promise<Plan> {
  const payload = await plansFetch(`/plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidatePlans(locale);

  return payload.data as Plan;
}

export async function togglePlan(
  id: number,
  locale: AppLocale
): Promise<Plan> {
  const payload = await plansFetch(`/plans/${id}/toggle`, {
    method: "PATCH",
  });

  revalidatePlans(locale);

  return payload.data as Plan;
}

export async function deletePlan(id: number, locale: AppLocale): Promise<void> {
  await plansFetch(`/plans/${id}`, {
    method: "DELETE",
  });

  revalidatePlans(locale);
}

function revalidatePlans(locale: AppLocale) {
  revalidatePath(`/${locale}/plans`);
  revalidatePath(`/${locale}/members`);
  revalidatePath(`/${locale}/subscriptions`);
  revalidateTag("plans", "max");
  revalidateTag("members", "max");
  revalidateTag("subscriptions", "max");
}
