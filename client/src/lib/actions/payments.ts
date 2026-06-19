"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import type { Payment } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type PaymentFormData = {
  subscription_id: number;
  amount: string;
  method: "cash" | "card" | "bank_transfer";
  paid_at?: string | null;
};

async function paymentsFetch(path: string, options: RequestInit = {}) {
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

    if (details && Object.keys(details).length > 0) {
      throw new Error(JSON.stringify({ message: errorMessage, details }));
    }

    throw new Error(errorMessage);
  }

  return payload;
}

export async function recordPayment(
  data: PaymentFormData,
  locale: AppLocale
): Promise<Payment> {
  const payload = await paymentsFetch("/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidatePath(`/${locale}/payments`);
  revalidatePath(`/${locale}/subscriptions`);
  revalidatePath(`/${locale}/members`);
  revalidateTag("payments", "max");
  revalidateTag("subscriptions", "max");
  revalidateTag("members", "max");

  return payload.data as Payment;
}
