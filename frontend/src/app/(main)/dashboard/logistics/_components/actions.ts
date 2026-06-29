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

export async function updateProduct(input: FormData): Promise<LogisticsActionResult> {
  const productId = Number(input.get("id"));
  const payload = {
    category: String(input.get("category") ?? ""),
    cost: String(input.get("cost") ?? "0"),
    low_stock_threshold: Number(input.get("low_stock_threshold") ?? 0),
    name: String(input.get("name") ?? ""),
    price: String(input.get("price") ?? "0"),
    sku: String(input.get("sku") ?? ""),
    stock_quantity: Number(input.get("stock_quantity") ?? 0),
  };

  try {
    await serverApiFetch(`/products/${productId}`, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update product.",
    };
  }

  revalidateInventory();

  return { ok: true, message: "Product updated." };
}

export async function toggleProduct(input: FormData): Promise<LogisticsActionResult> {
  return mutateSimple(`/products/${Number(input.get("id"))}/toggle`, "PATCH", "Product status updated.");
}

export async function deleteProduct(input: FormData): Promise<LogisticsActionResult> {
  return mutateSimple(`/products/${Number(input.get("id"))}`, "DELETE", "Product deleted.");
}

export async function adjustProductStock(input: FormData): Promise<LogisticsActionResult> {
  const payload = {
    quantity: Number(input.get("quantity") || 0),
    reason: String(input.get("reason") || ""),
    type: String(input.get("type") || "in"),
  };

  return mutateJson(`/products/${Number(input.get("id"))}/stock`, "POST", payload, "Stock adjusted.");
}

export async function receivePurchaseOrder(input: FormData): Promise<LogisticsActionResult> {
  const items = String(input.get("items") || "")
    .split("|")
    .filter(Boolean)
    .map((pair) => {
      const [id, quantity] = pair.split(":");

      return {
        id: Number(id),
        quantity_received: Number(input.get(`received_${id}`) || quantity || 0),
      };
    });

  return mutateJson(
    `/purchase-orders/${Number(input.get("id"))}/receive`,
    "POST",
    {
      items,
      notes: String(input.get("notes") || ""),
    },
    "Purchase order received.",
  );
}

async function mutateSimple(path: string, method: string, message: string): Promise<LogisticsActionResult> {
  try {
    await serverApiFetch(path, { method });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Action failed." };
  }

  revalidateInventory();

  return { ok: true, message };
}

async function mutateJson(
  path: string,
  method: string,
  payload: Record<string, unknown>,
  message: string,
): Promise<LogisticsActionResult> {
  try {
    await serverApiFetch(path, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Action failed." };
  }

  revalidateInventory();

  return { ok: true, message };
}

function revalidateInventory() {
  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/ecommerce");
  revalidatePath("/dashboard/finance");
}
