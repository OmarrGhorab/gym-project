"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function saveEmployee(input: FormData): Promise<void> {
  const id = Number(input.get("id"));
  const payload = {
    base_salary: String(input.get("base_salary") || "0"),
    commission_rate: String(input.get("commission_rate") || "0"),
    hire_date: nullableString(input.get("hire_date")),
    name: String(input.get("name") || ""),
    phone: nullableString(input.get("phone")),
    role: String(input.get("role") || "employee"),
    shift_id: nullableNumber(input.get("shift_id")),
    status: String(input.get("status") || "active"),
    user_id: nullableNumber(input.get("user_id")),
  };

  await serverApiFetch(id > 0 ? `/employees/${id}` : "/employees", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: id > 0 ? "PUT" : "POST",
  });

  revalidateStaff();
}

export async function deleteEmployee(input: FormData): Promise<void> {
  await serverApiFetch(`/employees/${Number(input.get("id"))}`, {
    method: "DELETE",
  });

  revalidateStaff();
}

export async function backfillCommissions(input: FormData): Promise<void> {
  await serverApiFetch("/commissions/backfill", {
    body: JSON.stringify({
      dry_run: input.get("dry_run") === "on",
      from: String(input.get("from") || ""),
      to: String(input.get("to") || ""),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  revalidateStaff();
}

function revalidateStaff() {
  revalidatePath("/dashboard/academy");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/settings");
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}
