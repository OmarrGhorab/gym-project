"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ServerApiError, serverApiFetch } from "@/lib/api/server";

export type AbsenceFormState = {
  ok: boolean;
  message: string;
  errors: Partial<Record<string, string[]>>;
  values: Record<string, string>;
};

export type AbsenceActionResult = {
  ok: boolean;
  message: string;
};

const absenceSchema = z.object({
  absence_id: z.union([z.literal(""), z.string().regex(/^\d+$/)]),
  employee_id: z.coerce.number().int().positive("Employee is required."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid absence date."),
  reason: z.string().trim().min(1, "Reason is required.").max(500, "Reason must be 500 characters or fewer."),
  deduct: z.enum(["0", "1"]),
  deduction_amount: z.coerce.number().min(0, "Deduction cannot be negative."),
});

export async function saveEmployeeAbsence(_state: AbsenceFormState, input: FormData): Promise<AbsenceFormState> {
  const values = formValues(input);
  const parsed = absenceSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const id = parsed.data.absence_id;
  const payload = {
    employee_id: parsed.data.employee_id,
    date: parsed.data.date,
    reason: parsed.data.reason,
    deduction_amount: parsed.data.deduct === "1" ? String(parsed.data.deduction_amount) : "0",
  };

  try {
    await serverApiFetch(id ? `/employee-absences/${id}` : "/employee-absences", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: id ? "PUT" : "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save the absence.",
      errors: apiErrors(error),
      values,
    };
  }

  revalidateAbsencePages();

  return {
    ok: true,
    message: id ? "Absence updated." : "Absence recorded.",
    errors: {},
    values: {},
  };
}

export async function deleteEmployeeAbsence(input: FormData): Promise<AbsenceActionResult> {
  const id = Number(input.get("id"));

  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, message: "Absence record is required." };
  }

  try {
    await serverApiFetch(`/employee-absences/${id}`, { method: "DELETE" });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete the absence.",
    };
  }

  revalidateAbsencePages();

  return { ok: true, message: "Absence deleted." };
}

function formValues(input: FormData): Record<string, string> {
  return {
    absence_id: String(input.get("absence_id") || ""),
    employee_id: String(input.get("employee_id") || ""),
    date: String(input.get("date") || ""),
    reason: String(input.get("reason") || ""),
    deduct: input.get("deduct") === "1" ? "1" : "0",
    deduction_amount: String(input.get("deduction_amount") || "0"),
  };
}

function apiErrors(error: unknown): Partial<Record<string, string[]>> {
  if (!(error instanceof ServerApiError) || !error.details) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(error.details).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value];
      }

      return [key, value ? [value] : []];
    }),
  );
}

function revalidateAbsencePages() {
  revalidatePath("/dashboard/absences");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/finance");
}
