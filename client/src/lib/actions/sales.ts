"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";
import type { AppLocale } from "@/i18n/routing";
import type { Sale } from "@/lib/api/dashboard";

export type SaleCreateData = {
  idempotency_key: string;
  member_id?: number;
  payment_method: "cash" | "card" | "bank_transfer";
  discount?: string;
  notes?: string;
  items: {
    product_id: number;
    quantity: number;
  }[];
};

async function salesFetch(path: string, options: RequestInit = {}) {
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

export async function createSale(
  data: SaleCreateData,
  locale: AppLocale
): Promise<Sale> {
  const payload = await salesFetch("/sales", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateSales(locale);

  return payload.data as Sale;
}

function revalidateSales(locale: AppLocale) {
  revalidatePath(`/${locale}/pos`);
  revalidatePath(`/${locale}/products`);
  revalidatePath(`/${locale}`);
  revalidateTag("sales", "max");
  revalidateTag("products", "max");
}
