"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import type { Employee } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type EmployeeFormData = {
  name: string;
  phone?: string | null;
  role: "employee" | "captain" | "manager";
  base_salary?: string | null;
  commission_rate?: string | null;
  hire_date?: string | null;
  status?: "active" | "inactive";
  user_id?: number | null;
};

async function employeesFetch(path: string, options: RequestInit = {}) {
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

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const details =
      (payload.error as { details?: Record<string, string[]> } | undefined)?.details ?? undefined;
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

export async function createEmployee(
  data: EmployeeFormData,
  locale: AppLocale
): Promise<Employee> {
  const payload = await employeesFetch("/employees", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateEmployees(locale);

  return payload.data as Employee;
}

export async function updateEmployee(
  id: number,
  data: EmployeeFormData,
  locale: AppLocale
): Promise<Employee> {
  const payload = await employeesFetch(`/employees/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidateEmployees(locale);

  return payload.data as Employee;
}

export async function deleteEmployee(id: number, locale: AppLocale): Promise<void> {
  await employeesFetch(`/employees/${id}`, {
    method: "DELETE",
  });

  revalidateEmployees(locale);
}

function revalidateEmployees(locale: AppLocale) {
  revalidatePath(`/${locale}/teams`);
  revalidatePath(`/${locale}/trainers`);
  revalidatePath(`/${locale}/payroll`);
  revalidatePath(`/${locale}/commissions`);
  revalidateTag("employees", "max");
  revalidateTag("payroll", "max");
  revalidateTag("commissions", "max");
}
