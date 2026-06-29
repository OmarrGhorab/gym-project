"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type LogisticsActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function createProduct(input: FormData): Promise<LogisticsActionResult> {
  const payload = new FormData();

  for (const key of ["name", "category", "sku", "price", "cost", "stock_quantity", "low_stock_threshold"]) {
    payload.set(key, String(input.get(key) ?? ""));
  }

  const image = input.get("image");
  if (image instanceof File && image.size > 0) {
    payload.set("image", image);
  }

  try {
    await serverApiFetch("/products", {
      body: payload,
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create product.",
    };
  }

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/ecommerce");

  return {
    ok: true,
    message: "Product created.",
  };
}

export async function createPurchaseOrder(input: FormData): Promise<LogisticsActionResult> {
  const payload = {
    expected_at: String(input.get("expected_at") ?? ""),
    items: [
      {
        product_id: Number(input.get("product_id")),
        quantity_ordered: Number(input.get("quantity_ordered")),
        unit_cost: String(input.get("unit_cost") ?? "0"),
      },
    ],
    notes: String(input.get("notes") ?? ""),
    supplier_name: String(input.get("supplier_name") ?? ""),
    supplier_phone: String(input.get("supplier_phone") ?? ""),
  };

  try {
    await serverApiFetch("/purchase-orders", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create purchase order.",
    };
  }

  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/ecommerce");

  return {
    ok: true,
    message: "Purchase order created.",
  };
}
