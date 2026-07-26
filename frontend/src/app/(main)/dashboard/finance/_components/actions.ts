"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type FinanceActionResult =
  | {
      ok: true;
      message: string;
      errors?: Partial<Record<string, string[]>>;
    }
  | {
      ok: false;
      message: string;
      errors?: Partial<Record<string, string[]>>;
    };

export type ExpenseFormState = {
  errors: Partial<Record<string, string[]>>;
  message?: string;
  ok: boolean;
  values: Record<string, string>;
};

const expenseInputSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  category: z.string().trim().min(1, "Category is required.").max(100),
  date: z.string().date("Date is required."),
  description: z.string().trim().max(1000).optional().default(""),
});

const paymentInputSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  method: z.enum(["cash", "card", "bank_transfer"], { error: "Choose a valid payment method." }),
  paid_at: z.string().min(1).optional(),
  subscription_id: z.coerce.number().int().positive("Subscription is required."),
});

export async function createExpense(_state: ExpenseFormState, input: FormData): Promise<ExpenseFormState> {
  const values = getFormValues(input);
  const parsed = expenseInputSchema.safeParse({
    amount: input.get("amount"),
    category: input.get("category"),
    date: input.get("date"),
    description: input.get("description"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await serverApiFetch("/expenses", {
      body: JSON.stringify(parsed.data),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create expense.",
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/finance");

  return {
    ok: true,
    message: "Expense recorded.",
    errors: {},
    values: {},
  };
}

function getFormValues(input: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(input.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
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
  const parsed = paymentInputSchema.safeParse({
    amount: input.get("amount"),
    method: input.get("method") ?? "cash",
    paid_at: String(input.get("paid_at") || new Date().toISOString()),
    subscription_id: input.get("subscription_id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please check the payment fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const payload = {
    amount: String(parsed.data.amount),
    method: parsed.data.method,
    paid_at: parsed.data.paid_at || new Date().toISOString(),
    subscription_id: parsed.data.subscription_id,
  };

  return mutateFinance("/payments", "POST", payload, "Payment recorded.");
}

export async function openShiftSession(input: {
  employee_shift_id: number;
  employee_id?: number;
  opening_float?: string;
  force_open?: boolean;
}): Promise<FinanceActionResult> {
  return mutateFinance(
    "/shift-sessions",
    "POST",
    {
      employee_shift_id: input.employee_shift_id,
      // Omitted entirely when opening as yourself — the API resolves you from your own employee record.
      ...(input.employee_id ? { employee_id: input.employee_id } : {}),
      opening_float: input.opening_float ?? "0",
      force_open: input.force_open ?? false,
    },
    "Shift session opened.",
  );
}

export async function closeShiftSession(id: number, employeeId?: number): Promise<FinanceActionResult> {
  return mutateFinance(
    `/shift-sessions/${id}/close`,
    "POST",
    employeeId ? { employee_id: employeeId } : {},
    "Shift session closed.",
  );
}

export async function assignShiftStaff(id: number, employeeId: number): Promise<FinanceActionResult> {
  return mutateFinance(`/shift-sessions/${id}/staff`, "PUT", { employee_id: employeeId }, "Staff on duty updated.");
}

export async function submitShiftHandover(
  id: number,
  input: {
    counted_cash: string;
    counted_card: string;
    counted_bank: string;
    counted_expenses: string;
    variance_notes?: string;
  },
): Promise<FinanceActionResult> {
  return mutateFinance(`/shift-sessions/${id}/handover`, "POST", input, "Handover submitted for review.");
}

export async function reviewShiftHandover(
  id: number,
  decision: "accepted" | "rejected",
  notes?: string,
): Promise<FinanceActionResult> {
  return mutateFinance(
    `/shift-sessions/${id}/review`,
    "POST",
    { decision, ...(notes ? { notes } : {}) },
    decision === "accepted" ? "Handover accepted." : "Handover rejected.",
  );
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
      errors: {},
    };
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/default");

  return { ok: true, message };
}
