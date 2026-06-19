"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import type { Expense } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type ExpenseFormData = {
  category: string;
  amount: string;
  date: string;
  description?: string | null;
};

async function expensesFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const details =
      (payload.error as { details?: Record<string, string[]> } | undefined)
        ?.details ?? undefined;
    const errorMessage =
      ((payload.error as { message?: string })?.message) ??
      (payload.message as string) ??
      response.statusText;

    if (details && Object.keys(details).length > 0) {
      throw new Error(JSON.stringify({ message: errorMessage, details }));
    }

    throw new Error(errorMessage);
  }

  return payload;
}

export async function createExpense(
  data: ExpenseFormData,
  locale: AppLocale
): Promise<Expense> {
  const payload = await expensesFetch("/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateExpenses(locale);

  return payload.data as Expense;
}

export async function updateExpense(
  id: number,
  data: ExpenseFormData,
  locale: AppLocale
): Promise<Expense> {
  const payload = await expensesFetch(`/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidateExpenses(locale);

  return payload.data as Expense;
}

export async function deleteExpense(id: number, locale: AppLocale): Promise<void> {
  await expensesFetch(`/expenses/${id}`, {
    method: "DELETE",
  });

  revalidateExpenses(locale);
}

function revalidateExpenses(locale: AppLocale) {
  revalidatePath(`/${locale}/expenses`);
  revalidatePath(`/${locale}/payroll`);
  revalidateTag("expenses", "max");
  revalidateTag("payroll", "max");
}
