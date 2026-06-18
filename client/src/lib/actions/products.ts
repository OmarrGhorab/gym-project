"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";
import type { AppLocale } from "@/i18n/routing";
import type { Product } from "@/lib/api/dashboard";

export type ProductFormData = {
  name: string;
  category: string;
  sku: string;
  price: string;
  cost: string;
  stock_quantity?: number;
  low_stock_threshold?: number;
};

export type StockAdjustmentData = {
  type: "in" | "out";
  quantity: number;
  reason: string;
};

async function productsFetch(path: string, options: RequestInit = {}) {
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

export async function createProduct(
  data: ProductFormData,
  locale: AppLocale
): Promise<Product> {
  const payload = await productsFetch("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateProducts(locale);

  return payload.data as Product;
}

export async function updateProduct(
  id: number,
  data: ProductFormData,
  locale: AppLocale
): Promise<Product> {
  const payload = await productsFetch(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidateProducts(locale);

  return payload.data as Product;
}

export async function toggleProduct(
  id: number,
  locale: AppLocale
): Promise<Product> {
  const payload = await productsFetch(`/products/${id}/toggle`, {
    method: "PATCH",
  });

  revalidateProducts(locale);

  return payload.data as Product;
}

export async function adjustProductStock(
  id: number,
  data: StockAdjustmentData,
  locale: AppLocale
): Promise<Product> {
  const payload = await productsFetch(`/products/${id}/stock`, {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateProducts(locale);

  return payload.data as Product;
}

function revalidateProducts(locale: AppLocale) {
  revalidatePath(`/${locale}/products`);
  revalidatePath(`/${locale}/pos`);
  revalidatePath(`/${locale}`);
  revalidateTag("products", "max");
  revalidateTag("sales", "max");
}
