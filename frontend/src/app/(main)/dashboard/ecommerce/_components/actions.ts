"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

import { randomUUID } from "node:crypto";

import type { PosMemberOption } from "./data";

export type PosActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function createSale(input: FormData): Promise<PosActionResult> {
  const productId = Number(input.get("product_id"));
  const quantity = Number(input.get("quantity") || 1);

  try {
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
  try {
    await serverApiFetch(`/sales/${String(input.get("id")).replace(/^#/, "")}/void`, {
      body: JSON.stringify({
        reason: nullableString(input.get("reason")) ?? "Voided from dashboard",
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
