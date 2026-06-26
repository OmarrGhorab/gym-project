"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import type { Subscription } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type RenewSubscriptionData = {
  plan_id?: number;
  discount?: string;
  payment: {
    amount: string;
    method: "cash" | "card" | "bank_transfer";
    paid_at?: string;
  };
};

export type FreezeSubscriptionData = {
  freeze_start: string;
  freeze_end: string;
  reason?: string;
};

export type CreateSubscriptionData = {
  member_id: number;
  plan_id: number;
  start_date: string;
  end_date?: string | null;
  discount?: string | null;
  payment: {
    amount: string;
    method: "cash" | "card" | "bank_transfer";
    paid_at?: string | null;
  };
};

async function subscriptionsFetch(path: string, options: RequestInit = {}) {
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

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const details =
      (payload.error as { details?: Record<string, string[]> } | undefined)?.details ?? undefined;
    const errorMessage =
      ((payload.error as { message?: string })?.message) ??
      (payload.message as string) ??
      response.statusText;

    if (details && Object.keys(details).length > 0) {
      throw new Error(JSON.stringify({ message: errorMessage, details }));
    }

    throw new Error(errorMessage);
  }

  return payload;
}

export async function renewSubscription(
  id: number,
  data: RenewSubscriptionData,
  locale: AppLocale
): Promise<Subscription> {
  const payload = await subscriptionsFetch(`/subscriptions/${id}/renew`, {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateSubscriptions(locale);

  return payload.data as Subscription;
}

export async function createSubscription(
  data: CreateSubscriptionData,
  locale: AppLocale
): Promise<Subscription> {
  const payload = await subscriptionsFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateSubscriptions(locale);
  revalidatePath(`/${locale}`);
  revalidateTag("dashboard", "max");

  return payload.data as Subscription;
}

export async function freezeSubscription(
  id: number,
  data: FreezeSubscriptionData,
  locale: AppLocale
): Promise<Subscription> {
  const payload = await subscriptionsFetch(`/subscriptions/${id}/freeze`, {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateSubscriptions(locale);

  return payload.data as Subscription;
}

export async function unfreezeSubscription(id: number, locale: AppLocale): Promise<Subscription> {
  const payload = await subscriptionsFetch(`/subscriptions/${id}/unfreeze`, {
    method: "POST",
  });

  revalidateSubscriptions(locale);

  return payload.data as Subscription;
}

export async function stopSubscription(id: number, locale: AppLocale): Promise<Subscription> {
  const payload = await subscriptionsFetch(`/subscriptions/${id}/stop`, {
    method: "POST",
  });

  revalidateSubscriptions(locale);

  return payload.data as Subscription;
}

function revalidateSubscriptions(locale: AppLocale) {
  revalidatePath(`/${locale}/subscriptions`);
  revalidatePath(`/${locale}/members`);
  revalidatePath(`/${locale}/payments`);
  revalidateTag("subscriptions", "max");
  revalidateTag("members", "max");
  revalidateTag("payments", "max");
}
