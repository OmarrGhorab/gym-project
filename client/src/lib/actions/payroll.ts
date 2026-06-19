"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import type { Payroll } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type PayrollAdjustmentData = {
  bonuses?: string | null;
  deductions?: string | null;
};

async function payrollFetch(path: string, options: RequestInit = {}) {
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

export async function generatePayroll(
  month: string,
  locale: AppLocale
): Promise<Payroll[]> {
  const payload = await payrollFetch(`/payroll/generate?month=${month}`, {
    method: "POST",
  });

  revalidatePayroll(locale);

  return payload.data as Payroll[];
}

export async function updatePayroll(
  id: number,
  data: PayrollAdjustmentData,
  locale: AppLocale
): Promise<Payroll> {
  const payload = await payrollFetch(`/payroll/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidatePayroll(locale);

  return payload.data as Payroll;
}

export async function payPayroll(
  id: number,
  locale: AppLocale
): Promise<Payroll> {
  const payload = await payrollFetch(`/payroll/${id}/pay`, {
    method: "POST",
  });

  revalidatePayroll(locale);

  return payload.data as Payroll;
}

function revalidatePayroll(locale: AppLocale) {
  revalidatePath(`/${locale}/payroll`);
  revalidatePath(`/${locale}/expenses`);
  revalidateTag("payroll", "max");
  revalidateTag("expenses", "max");
}
