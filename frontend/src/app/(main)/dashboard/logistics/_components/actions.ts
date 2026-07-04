"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

import type { InventoryProduct, PaginationMeta, ProductFilters } from "./shipment-data";

export type LogisticsActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

const optionalTextInput = (max: number) =>
  z.preprocess((value) => {
    const normalized = String(value ?? "").trim();

    return normalized.length > 0 ? normalized : null;
  }, z.string().max(max).nullable());

const productInputSchema = z.object({
  category: z.string().trim().min(1, "Category is required.").max(100, "Category is too long."),
  cost: z.coerce.number().min(0, "Cost cannot be negative."),
  low_stock_threshold: z.coerce.number().int().min(0, "Low stock threshold cannot be negative."),
  name: z.string().trim().min(1, "Product name is required.").max(191, "Product name is too long."),
  price: z.coerce.number().gt(0, "Price must be greater than 0."),
  sku: z.string().trim().min(1, "SKU is required.").max(100, "SKU is too long."),
  stock_quantity: z.coerce.number().int().min(0, "Stock quantity cannot be negative."),
});

const productIdSchema = z.coerce.number().int().min(1, "Product is required.");

const purchaseOrderInputSchema = z.object({
  expected_at: optionalTextInput(40),
  product_id: productIdSchema,
  quantity_ordered: z.coerce.number().int().min(1, "Quantity ordered must be at least 1."),
  notes: optionalTextInput(2000),
  supplier_name: z.string().trim().min(1, "Supplier name is required.").max(191, "Supplier name is too long."),
  supplier_phone: optionalTextInput(40),
  unit_cost: z.coerce.number().min(0, "Unit cost cannot be negative."),
});

const stockAdjustmentInputSchema = z.object({
  id: productIdSchema,
  quantity: z.coerce.number().int().gt(0, "Quantity must be greater than 0."),
  reason: z.string().trim().min(1, "Reason is required.").max(255, "Reason is too long."),
  type: z.enum(["in", "out"], {
    error: "Stock type must be stock in or stock out.",
  }),
});

const receivePurchaseOrderInputSchema = z
  .object({
    id: z.coerce.number().int().min(1, "Purchase order is required."),
    items: z.string().trim(),
    notes: optionalTextInput(2000),
  })
  .superRefine((value, context) => {
    const itemPairs = parseReceiveItems(value.items);

    if (itemPairs.some((item) => !Number.isInteger(item.id) || item.id < 1)) {
      context.addIssue({
        code: "custom",
        message: "Received item is invalid.",
        path: ["items"],
      });
    }
  });

export async function createProduct(input: FormData): Promise<LogisticsActionResult> {
  const parsed = productInputSchema.safeParse({
    category: input.get("category"),
    cost: input.get("cost") ?? "0",
    low_stock_threshold: input.get("low_stock_threshold") ?? "0",
    name: input.get("name"),
    price: input.get("price") ?? "0",
    sku: input.get("sku"),
    stock_quantity: input.get("stock_quantity") ?? "0",
  });

  if (!parsed.success) {
    return invalidActionResult(parsed.error);
  }

  const payload = new FormData();

  for (const [key, value] of Object.entries(parsed.data)) {
    payload.set(key, String(value));
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
  const parsed = purchaseOrderInputSchema.safeParse({
    expected_at: input.get("expected_at"),
    notes: input.get("notes"),
    product_id: input.get("product_id"),
    quantity_ordered: input.get("quantity_ordered"),
    supplier_name: input.get("supplier_name"),
    supplier_phone: input.get("supplier_phone"),
    unit_cost: input.get("unit_cost") ?? "0",
  });

  if (!parsed.success) {
    return invalidActionResult(parsed.error);
  }

  const data = parsed.data;
  const payload = new FormData();
  payload.set("supplier_name", data.supplier_name);
  if (data.supplier_phone) payload.set("supplier_phone", data.supplier_phone);
  if (data.expected_at) payload.set("expected_at", data.expected_at);
  if (data.notes) payload.set("notes", data.notes);

  payload.set("items[0][product_id]", String(data.product_id));
  payload.set("items[0][quantity_ordered]", String(data.quantity_ordered));
  payload.set("items[0][unit_cost]", String(data.unit_cost));

  const image = input.get("image");
  if (image instanceof File && image.size > 0) {
    payload.set("image", image);
  }

  try {
    await serverApiFetch("/purchase-orders", {
      body: payload,
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
  const id = productIdSchema.safeParse(input.get("id"));
  const parsed = productInputSchema.safeParse({
    category: input.get("category"),
    cost: input.get("cost") ?? "0",
    low_stock_threshold: input.get("low_stock_threshold") ?? "0",
    name: input.get("name"),
    price: input.get("price") ?? "0",
    sku: input.get("sku"),
    stock_quantity: input.get("stock_quantity") ?? "0",
  });

  if (!id.success) {
    return invalidActionResult(id.error);
  }

  if (!parsed.success) {
    return invalidActionResult(parsed.error);
  }

  const payload = new FormData();
  payload.set("_method", "PUT");
  for (const [key, value] of Object.entries(parsed.data)) {
    payload.set(key, String(value));
  }

  const image = input.get("image");
  if (image instanceof File && image.size > 0) {
    payload.set("image", image);
  }

  try {
    await serverApiFetch(`/products/${id.data}`, {
      body: payload,
      method: "POST",
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
  const id = productIdSchema.safeParse(input.get("id"));

  if (!id.success) {
    return invalidActionResult(id.error);
  }

  return mutateSimple(`/products/${id.data}/toggle`, "PATCH", "Product status updated.");
}

export async function deleteProduct(input: FormData): Promise<LogisticsActionResult> {
  const id = productIdSchema.safeParse(input.get("id"));

  if (!id.success) {
    return invalidActionResult(id.error);
  }

  return mutateSimple(`/products/${id.data}`, "DELETE", "Product deleted.");
}

export async function adjustProductStock(input: FormData): Promise<LogisticsActionResult> {
  const parsed = stockAdjustmentInputSchema.safeParse({
    id: input.get("id"),
    quantity: input.get("quantity") ?? "0",
    reason: input.get("reason"),
    type: input.get("type") ?? "in",
  });

  if (!parsed.success) {
    return invalidActionResult(parsed.error);
  }

  const { id, ...payload } = parsed.data;

  return mutateJson(`/products/${id}/stock`, "POST", payload, "Stock adjusted.");
}

export async function receivePurchaseOrder(input: FormData): Promise<LogisticsActionResult> {
  const parsed = receivePurchaseOrderInputSchema.safeParse({
    id: input.get("id"),
    items: input.get("items") ?? "",
    notes: input.get("notes"),
  });

  if (!parsed.success) {
    return invalidActionResult(parsed.error);
  }

  const items = parseReceiveItems(parsed.data.items).map((item) => ({
    id: item.id,
    quantity_received: z.coerce
      .number()
      .int()
      .min(0)
      .catch(item.defaultQuantity)
      .parse(input.get(`received_${item.id}`) ?? item.defaultQuantity),
  }));

  return mutateJson(
    `/purchase-orders/${parsed.data.id}/receive`,
    "POST",
    {
      items,
      notes: parsed.data.notes,
    },
    "Purchase order received.",
  );
}

export async function getProductsPage(
  page: number,
  perPage: number,
  filters: ProductFilters = {},
): Promise<{ products: InventoryProduct[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();

  params.set("sort", "name");
  params.set("per_page", String(perPage));
  params.set("page", String(page));

  if (filters.search?.trim()) {
    params.set("filter[search]", filters.search.trim());
  }

  if (filters.status && filters.status !== "all") {
    params.set("filter[is_active]", filters.status === "active" ? "1" : "0");
  }

  if (filters.stock === "low") {
    params.set("filter[is_low_stock]", "1");
  }

  if (filters.category && filters.category !== "all") {
    params.set("filter[category]", filters.category);
  }

  const result = await serverApiFetch<InventoryProduct[]>(`/products?${params.toString()}`);

  const meta = result.meta as Partial<PaginationMeta> | undefined;

  return {
    products: result.data ?? [],
    meta: {
      current_page: meta?.current_page ?? 1,
      per_page: meta?.per_page ?? perPage,
      total: meta?.total ?? 0,
      last_page: meta?.last_page ?? 1,
    },
  };
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

function invalidActionResult(error: z.ZodError): LogisticsActionResult {
  return {
    ok: false,
    message: error.issues[0]?.message ?? "Please check the form fields.",
  };
}

function parseReceiveItems(value: string) {
  return value
    .split("|")
    .filter(Boolean)
    .map((pair) => {
      const [id, quantity] = pair.split(":");

      return {
        defaultQuantity: Number(quantity || 0),
        id: Number(id),
      };
    });
}
