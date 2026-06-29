"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

import { randomUUID } from "node:crypto";

export async function createSale(input: FormData): Promise<void> {
  const productId = Number(input.get("product_id"));
  const quantity = Number(input.get("quantity") || 1);

  await serverApiFetch("/sales", {
    body: JSON.stringify({
      discount: String(input.get("discount") || "0"),
      idempotency_key: randomUUID(),
      items: [{ product_id: productId, quantity }],
      member_id: nullableNumber(input.get("member_id")),
      notes: nullableString(input.get("notes")),
      payment_method: String(input.get("payment_method") || "cash"),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  revalidatePos();
}

export async function voidSale(input: FormData): Promise<void> {
  await serverApiFetch(`/sales/${String(input.get("id")).replace(/^#/, "")}/void`, {
    body: JSON.stringify({
      reason: nullableString(input.get("reason")) ?? "Voided from dashboard",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  revalidatePos();
}

function revalidatePos() {
  revalidatePath("/dashboard/ecommerce");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/default");
  revalidatePath("/dashboard/logistics");
}

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}
