"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

import type { PosMemberOption } from "./data";
import { randomUUID } from "node:crypto";

export type PosActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

const optionalNumberInput = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}, z.coerce.number().int().min(1).nullable());

const optionalStringInput = (max: number) =>
  z.preprocess((value) => {
    const normalized = String(value ?? "").trim();

    return normalized.length > 0 ? normalized : null;
  }, z.string().max(max).nullable());

const posSaleInputSchema = z.object({
  discount: z.coerce.number().min(0, "Discount cannot be negative."),
  member_id: optionalNumberInput,
  notes: optionalStringInput(500),
  payment_method: z.enum(["cash", "card", "bank_transfer"], {
    error: "Payment method must be cash, card, or bank transfer.",
  }),
  product_id: z.coerce.number().int().min(1, "Product is required."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
});

const voidSaleInputSchema = z.object({
  id: z.preprocess(
    (value) =>
      String(value ?? "")
        .replace(/^#/, "")
        .trim(),
    z.coerce.number().int().min(1, "Sale is required."),
  ),
  reason: optionalStringInput(255),
});

export async function createSale(input: FormData): Promise<PosActionResult> {
  const parsed = posSaleInputSchema.safeParse({
    discount: input.get("discount") ?? "0",
    member_id: input.get("member_id"),
    notes: input.get("notes"),
    payment_method: input.get("payment_method") ?? "cash",
    product_id: input.get("product_id"),
    quantity: input.get("quantity") ?? "1",
  });

  if (!parsed.success) {
    return invalidActionResult(parsed.error);
  }

  const data = parsed.data;

  try {
    await serverApiFetch("/sales", {
      body: JSON.stringify({
        discount: String(data.discount),
        idempotency_key: randomUUID(),
        items: [{ product_id: data.product_id, quantity: data.quantity }],
        member_id: data.member_id,
        notes: data.notes,
        payment_method: data.payment_method,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create POS sale.",
    };
  }

  revalidatePos();

  return {
    ok: true,
    message: "POS sale created.",
  };
}

export async function voidSale(input: FormData): Promise<PosActionResult> {
  const parsed = voidSaleInputSchema.safeParse({
    id: input.get("id"),
    reason: input.get("reason"),
  });

  if (!parsed.success) {
    return invalidActionResult(parsed.error);
  }

  try {
    await serverApiFetch(`/sales/${parsed.data.id}/void`, {
      body: JSON.stringify({
        reason: parsed.data.reason ?? "Voided from dashboard",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not void POS sale.",
    };
  }

  revalidatePos();

  return {
    ok: true,
    message: "POS sale voided.",
  };
}

export async function searchPosMembers(query: string): Promise<PosMemberOption[]> {
  const normalized = query.trim();
  const params = new URLSearchParams({
    "filter[status]": "active",
    per_page: "25",
    sort: "name",
  });

  if (normalized.length > 0) {
    params.set("filter[search]", normalized);
  }

  const result = await serverApiFetch<PosMemberOption[] | { data: PosMemberOption[] }>(`/members?${params.toString()}`);

  return Array.isArray(result.data) ? result.data : result.data.data;
}

function revalidatePos() {
  revalidatePath("/dashboard/ecommerce");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/default");
  revalidatePath("/dashboard/logistics");
}

function invalidActionResult(error: z.ZodError): PosActionResult {
  return {
    ok: false,
    message: error.issues[0]?.message ?? "Please check the form fields.",
  };
}
