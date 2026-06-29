"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function generatePayroll(input: FormData): Promise<void> {
  const month = String(input.get("month") || "");

  await serverApiFetch(`/payroll/generate?month=${encodeURIComponent(month)}`, {
    method: "POST",
  });

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");
}

export async function markPayrollPaid(input: FormData): Promise<void> {
  const id = Number(input.get("id"));

  await serverApiFetch(`/payroll/${id}/pay`, {
    method: "POST",
  });

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");
}
