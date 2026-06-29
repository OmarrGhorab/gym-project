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

export async function updateExpense(input: FormData): Promise<FinanceActionResult> {
  const payload = {
    amount: String(input.get("amount") ?? ""),
    category: String(input.get("category") ?? ""),
    date: String(input.get("date") ?? ""),
    description: String(input.get("description") ?? ""),
  };

  return mutateFinance(`/expenses/${Number(input.get("id"))}`, "PUT", payload, "Expense updated.");
}

export async function deleteExpense(input: FormData): Promise<FinanceActionResult> {
  try {
    await serverApiFetch(`/expenses/${Number(input.get("id"))}`, { method: "DELETE" });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete expense.",
    };
  }

  revalidatePath("/dashboard/finance");

  return { ok: true, message: "Expense deleted." };
}

export async function recordPayment(input: FormData): Promise<FinanceActionResult> {
  const payload = {
    amount: String(input.get("amount") ?? ""),
    method: String(input.get("method") ?? "cash"),
    paid_at: String(input.get("paid_at") || new Date().toISOString()),
    subscription_id: Number(input.get("subscription_id")),
  };

  return mutateFinance("/payments", "POST", payload, "Payment recorded.");
}

export async function recordPaymentForm(input: FormData): Promise<void> {
  await recordPayment(input);
}

export async function updateExpenseForm(input: FormData): Promise<void> {
  await updateExpense(input);
}

export async function deleteExpenseForm(input: FormData): Promise<void> {
  await deleteExpense(input);
}

async function mutateFinance(
  path: string,
  method: string,
  payload: Record<string, unknown>,
  message: string,
): Promise<FinanceActionResult> {
  try {
    await serverApiFetch(path, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Action failed.",
    };
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/default");

  return { ok: true, message };
}
