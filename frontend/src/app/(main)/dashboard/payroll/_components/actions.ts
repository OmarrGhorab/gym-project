"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type PayrollActionState = {
  ok: boolean;
  message: string;
  errors: Partial<Record<string, string[]>>;
  values: Record<string, string>;
};

export type PayrollActionResult = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<string, string[]>>;
};

const payrollUpdateSchema = z.object({
  id: z.coerce.number().int().positive("Payroll record is required."),
  bonuses: z.coerce.number().min(0, "Bonus cannot be negative."),
  deductions: z.coerce.number().min(0, "Deduction cannot be negative."),
  attendance_deductions: z.coerce.number().min(0, "Attendance deduction cannot be negative."),
});

const payrollGenerateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Choose a valid payroll month."),
});

const payrollPaySchema = z.object({
  id: z.coerce.number().int().positive("Payroll record is required."),
});

const overtimeSettleSchema = z.object({
  id: z.coerce.number().int().positive("Overtime shift is required."),
});

export async function generatePayroll(input: FormData): Promise<PayrollActionResult> {
  const parsed = payrollGenerateSchema.safeParse({
    month: String(input.get("month") || ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted payroll fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch(`/payroll/generate?month=${encodeURIComponent(parsed.data.month)}`, {
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not generate payroll.",
      errors: {},
    };
  }

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");

  return { ok: true, message: "Payroll generated.", errors: {} };
}

export async function markPayrollPaid(input: FormData): Promise<PayrollActionResult> {
  const parsed = payrollPaySchema.safeParse({
    id: input.get("id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Payroll record is required.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch(`/payroll/${parsed.data.id}/pay`, {
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not mark payroll as paid.",
      errors: {},
    };
  }

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");

  return { ok: true, message: "Payroll paid.", errors: {} };
}

export async function updatePayroll(_state: PayrollActionState, input: FormData): Promise<PayrollActionState> {
  const values = getPayrollValues(input);
  const parsed = payrollUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted payroll fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await serverApiFetch(`/payroll/${parsed.data.id}`, {
      body: JSON.stringify({
        bonuses: String(parsed.data.bonuses),
        deductions: String(parsed.data.deductions),
        attendance_deductions: String(parsed.data.attendance_deductions),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Payroll could not be saved.",
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");

  return {
    ok: true,
    message: "Payroll saved.",
    errors: {},
    values,
  };
}

/**
 * Marks an approved overtime bonus as already typed into the employee's salary.
 * It never edits payroll itself — the amount is added by hand above.
 */
export async function settleOvertimeBonus(input: FormData): Promise<PayrollActionResult> {
  const parsed = overtimeSettleSchema.safeParse({ id: input.get("id") });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Overtime shift is required.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch(`/overtime-shifts/${parsed.data.id}`, {
      body: JSON.stringify({ decision: "settled" }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not mark the overtime bonus as added.",
      errors: {},
    };
  }

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/attendance");

  return { ok: true, message: "Overtime bonus marked as added to the salary.", errors: {} };
}

function getPayrollValues(input: FormData) {
  return {
    id: String(input.get("id") || ""),
    bonuses: String(input.get("bonuses") || "0"),
    deductions: String(input.get("deductions") || "0"),
    attendance_deductions: String(input.get("attendance_deductions") || "0"),
  };
}
