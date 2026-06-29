"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type PayrollActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function generatePayroll(input: FormData): Promise<PayrollActionResult> {
  const month = String(input.get("month") || "");

  try {
    await serverApiFetch(`/payroll/generate?month=${encodeURIComponent(month)}`, {
      method: "POST",
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not generate payroll." };
  }

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");

  return { ok: true, message: "Payroll generated." };
}

export async function markPayrollPaid(input: FormData): Promise<PayrollActionResult> {
  const id = Number(input.get("id"));

  try {
    await serverApiFetch(`/payroll/${id}/pay`, {
      method: "POST",
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not mark payroll paid." };
  }

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");

  return { ok: true, message: "Payroll paid." };
}
