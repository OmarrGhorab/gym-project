"use server";

import { serverApiFetch } from "@/lib/api/server";

export async function getEmployeeSubscriptionDetails(employeeId: number, from?: string, to?: string) {
  const params = new URLSearchParams();

  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const query = params.toString();
  const response = await serverApiFetch<Record<string, unknown>>(
    `/employees/${employeeId}/performance${query ? `?${query}` : ""}`,
  );

  return response.data;
}

export async function getProductSaleDetails(productId: number, from?: string, to?: string, paymentMethod?: string) {
  const params = new URLSearchParams({ product_id: String(productId) });

  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (paymentMethod) params.set("payment_method", paymentMethod);

  const response = await serverApiFetch<Record<string, unknown>>(`/reports/products-finance?${params.toString()}`);

  return response.data;
}
