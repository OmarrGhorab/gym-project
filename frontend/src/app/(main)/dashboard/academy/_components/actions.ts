"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type AcademyActionResult = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<string, string[]>>;
};

const employeePayDaySchema = z.object({
  id: z.coerce.number().int().positive("Employee is required."),
  pay_day: z.coerce
    .number()
    .int()
    .min(1, "Pay day must be between 1 and 31.")
    .max(31, "Pay day must be between 1 and 31."),
});

const nullablePositiveInt = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}, z.coerce.number().int().positive().nullable());

const optionalDate = z.preprocess(
  (value) => {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : null;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
    .nullable(),
);

const employeeSchema = z.object({
  base_salary: z.coerce.number().min(0, "Base salary cannot be negative."),
  hire_date: optionalDate,
  id: z.coerce.number().int().min(0),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120, "Name is too long."),
  phone: z.string().trim().max(40, "Phone is too long.").optional(),
  pay_day: z.coerce.number().int().min(1).max(31).nullable(),
  role: z.string().trim().min(1, "Role is required.").max(80, "Role is too long."),
  shift_id: nullablePositiveInt,
  status: z.enum(["active", "inactive"], { error: "Choose a valid status." }),
  user_id: nullablePositiveInt,
});

const commissionBackfillSchema = z
  .object({
    dry_run: z.boolean(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid from date."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid to date."),
  })
  .refine((value) => value.to >= value.from, {
    message: "To date cannot be before from date.",
    path: ["to"],
  });

const employeePlanCommissionRuleSchema = z.object({
  calculation_type: z.enum(["fixed", "percentage"], { error: "Choose a valid commission type." }),
  employee_id: z.coerce.number().int().positive("Employee is required."),
  id: z.coerce.number().int().min(0),
  is_active: z.boolean(),
  plan_id: nullablePositiveInt,
  value: z.coerce.number().min(0, "Commission value cannot be negative."),
});

export async function saveEmployee(input: FormData): Promise<AcademyActionResult> {
  const parsed = employeeSchema.safeParse({
    base_salary: input.get("base_salary") || "0",
    hire_date: input.get("hire_date"),
    id: input.get("id") || "0",
    name: input.get("name") || "",
    phone: input.get("phone") || "",
    pay_day: nullableNumber(input.get("pay_day")),
    role: input.get("role") || "employee",
    shift_id: input.get("shift_id"),
    status: input.get("status") || "active",
    user_id: input.get("user_id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted employee fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const id = parsed.data.id;
  const payload = {
    base_salary: String(parsed.data.base_salary),
    hire_date: parsed.data.hire_date,
    name: parsed.data.name,
    phone: nullableString(parsed.data.phone),
    pay_day: parsed.data.pay_day,
    role: parsed.data.role,
    shift_id: parsed.data.shift_id,
    status: parsed.data.status,
    user_id: parsed.data.user_id,
  };

  try {
    await serverApiFetch(id > 0 ? `/employees/${id}` : "/employees", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: id > 0 ? "PUT" : "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save employee.",
      errors: {},
    };
  }

  revalidateStaff();

  return { ok: true, message: id > 0 ? "Employee saved." : "Employee created.", errors: {} };
}

export async function deleteEmployee(input: FormData): Promise<AcademyActionResult> {
  const id = z.coerce.number().int().positive("Employee is required.").safeParse(input.get("id"));

  if (!id.success) {
    return { ok: false, message: "Employee is required.", errors: { id: ["Employee is required."] } };
  }

  try {
    await serverApiFetch(`/employees/${id.data}`, {
      method: "DELETE",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete employee.",
      errors: {},
    };
  }

  revalidateStaff();

  return { ok: true, message: "Employee deleted.", errors: {} };
}

export async function updateEmployeePayDay(input: FormData): Promise<AcademyActionResult> {
  const parsed = employeePayDaySchema.safeParse({
    id: input.get("id") || "0",
    pay_day: input.get("pay_day") || "0",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted pay day field.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch(`/employees/${parsed.data.id}`, {
      body: JSON.stringify({ pay_day: parsed.data.pay_day }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save pay day.",
      errors: {},
    };
  }

  revalidateStaff();

  return { ok: true, message: "Pay day saved.", errors: {} };
}

export async function backfillCommissions(input: FormData): Promise<AcademyActionResult> {
  const parsed = commissionBackfillSchema.safeParse({
    dry_run: input.get("dry_run") === "on",
    from: String(input.get("from") || ""),
    to: String(input.get("to") || ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted commission fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch("/commissions/backfill", {
      body: JSON.stringify(parsed.data),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not backfill commissions.",
      errors: {},
    };
  }

  revalidateStaff();

  return {
    ok: true,
    message: parsed.data.dry_run ? "Commission dry run completed." : "Commissions backfilled.",
    errors: {},
  };
}

export async function saveEmployeePlanCommissionRule(input: FormData): Promise<AcademyActionResult> {
  const parsed = employeePlanCommissionRuleSchema.safeParse({
    calculation_type: input.get("calculation_type") || "fixed",
    employee_id: input.get("employee_id") || "0",
    id: input.get("id") || "0",
    is_active: input.get("is_active") === "on",
    plan_id: input.get("plan_id"),
    value: input.get("value") || "0",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted coach commission fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { employee_id, id, ...payload } = parsed.data;

  try {
    await serverApiFetch(
      id > 0
        ? `/employees/${employee_id}/plan-commission-rules/${id}`
        : `/employees/${employee_id}/plan-commission-rules`,
      {
        body: JSON.stringify({
          ...payload,
          value: String(payload.value),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: id > 0 ? "PUT" : "POST",
      },
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save coach commission rule.",
      errors: {},
    };
  }

  revalidateStaff();

  return {
    ok: true,
    message: id > 0 ? "Coach commission rule saved." : "Coach commission rule created.",
    errors: {},
  };
}

export async function deleteEmployeePlanCommissionRule(input: FormData): Promise<AcademyActionResult> {
  const parsed = z
    .object({
      employee_id: z.coerce.number().int().positive("Employee is required."),
      id: z.coerce.number().int().positive("Rule is required."),
    })
    .safeParse({
      employee_id: input.get("employee_id") || "0",
      id: input.get("id") || "0",
    });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Coach commission rule is required.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch(`/employees/${parsed.data.employee_id}/plan-commission-rules/${parsed.data.id}`, {
      method: "DELETE",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete coach commission rule.",
      errors: {},
    };
  }

  revalidateStaff();

  return {
    ok: true,
    message: "Coach commission rule deleted.",
    errors: {},
  };
}

function revalidateStaff() {
  revalidatePath("/dashboard/academy");
  revalidatePath("/dashboard/academy/staff");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/settings");
}

function nullableString(value: FormDataEntryValue | string | null | undefined) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? Number(normalized) : null;
}
