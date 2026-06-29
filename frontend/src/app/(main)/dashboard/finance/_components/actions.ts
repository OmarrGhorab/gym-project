"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type FinanceActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function createExpense(input: FormData): Promise<FinanceActionResult> {
  const payload = {
    amount: String(input.get("amount") ?? ""),
    category: String(input.get("category") ?? ""),
    date: String(input.get("date") ?? ""),
    description: String(input.get("description") ?? ""),
  };

  try {
    await serverApiFetch("/expenses", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create expense.",
    };
  }

  revalidatePath("/dashboard/finance");

  return {
    ok: true,
    message: "Expense recorded.",
  };
}
