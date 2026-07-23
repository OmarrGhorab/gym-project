"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

const planEmployeeRuleSchema = z.object({
  calculation_type: z.enum(["fixed", "percentage"]),
  employee_id: z.coerce.number().int().positive(),
  id: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
  value: z.coerce.number().min(0),
});

const planInputSchema = z
  .object({
    access_ends_at: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().nullable()),
    access_starts_at: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.string().nullable(),
    ),
    access_grace_days: z.coerce.number().int().min(0, "Access grace days cannot be negative."),
    cancellation_grace_days: z.coerce.number().int().min(0, "Cancellation grace days cannot be negative."),
    category: z.string().trim().min(1, "Plan category is required."),
    description: z.string().trim().max(5000).optional(),
    duration_basis: z.enum(["days", "months"]).default("days"),
    duration_days: z.coerce.number().int().min(1, "Duration days must be at least 1."),
    duration_months: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.coerce.number().int().min(1, "Duration months must be at least 1.").nullable(),
    ),
    freeze_requires_approval: z.preprocess((value) => value === "on" || value === true, z.boolean().default(false)),
    is_unlimited_sessions: z.preprocess((value) => value === "on" || value === true, z.boolean().default(false)),
    max_freeze_days: z.coerce.number().int().min(0, "Max freeze days cannot be negative."),
    min_freeze_days: z.coerce.number().int().min(0, "Min freeze days cannot be negative."),
    name: z.string().trim().min(1, "Plan name is required.").max(150),
    price: z.coerce.number().min(0, "Price cannot be negative."),
    sessions_count: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.coerce.number().int().min(1, "Sessions count must be at least 1.").nullable(),
    ),
    type: z.enum(["membership", "offer", "fitness_studio"], {
      error: "Plan type must be Membership, Offer, or Fitness Studio.",
    }),
    valid_from: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().nullable()),
    valid_to: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().nullable()),
  })
  .refine((value) => value.max_freeze_days <= value.duration_days, {
    message: "Max freeze days cannot be greater than the plan duration.",
    path: ["max_freeze_days"],
  })
  .refine((value) => value.type !== "offer" || Boolean(value.valid_from), {
    message: "Offer valid from date is required.",
    path: ["valid_from"],
  })
  .refine((value) => value.type !== "offer" || Boolean(value.valid_to), {
    message: "Offer valid to date is required.",
    path: ["valid_to"],
  })
  .refine((value) => value.min_freeze_days <= value.max_freeze_days, {
    message: "Min freeze days cannot be greater than max freeze days.",
    path: ["min_freeze_days"],
  })
  .refine(
    (value) => {
      if (value.valid_from && value.valid_to) {
        return new Date(value.valid_to) >= new Date(value.valid_from);
      }
      return true;
    },
    {
      message: "Valid to must be on or after valid from.",
      path: ["valid_to"],
    },
  )
  .refine(
    (value) => {
      if (value.access_starts_at && value.access_ends_at) {
        return value.access_ends_at > value.access_starts_at;
      }
      return true;
    },
    {
      message: "Access end must be after access start.",
      path: ["access_ends_at"],
    },
  );

export type PlanFormState = {
  ok: boolean;
  message?: string;
  errors: Partial<Record<string, string[]>>;
  values: Record<string, string>;
};

export async function createPlan(_state: PlanFormState, input: FormData): Promise<PlanFormState> {
  const parsed = planInputSchema.safeParse({
    access_ends_at: input.get("access_ends_at"),
    access_starts_at: input.get("access_starts_at"),
    access_grace_days: input.get("access_grace_days"),
    cancellation_grace_days: input.get("cancellation_grace_days") ?? "2",
    category: input.get("category"),
    description: input.get("description"),
    duration_basis: input.get("duration_basis"),
    duration_days: input.get("duration_days"),
    duration_months: input.get("duration_months"),
    freeze_requires_approval: input.get("freeze_requires_approval"),
    is_unlimited_sessions: input.get("is_unlimited_sessions"),
    max_freeze_days: input.get("max_freeze_days"),
    min_freeze_days: input.get("min_freeze_days"),
    name: input.get("name"),
    price: input.get("price"),
    sessions_count: input.get("sessions_count"),
    type: input.get("type"),
    valid_from: input.get("valid_from"),
    valid_to: input.get("valid_to"),
  });

  const values = getFormValues(input);
  const commissionRules = parsePlanEmployeeRules(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid plan input.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    const planResult = await mutate<{
      id: number;
    }>("/plans", "POST", {
      ...parsed.data,
      description: parsed.data.description ?? "",
      duration_months: parsed.data.duration_basis === "months" ? parsed.data.duration_months : null,
      price: String(parsed.data.price),
    });
    await syncPlanEmployeeRules(planResult.data.id, [], commissionRules);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create plan.",
      errors: {},
      values,
    };
  }

  return {
    ok: true,
    message: "Plan created.",
    errors: {},
    values: {},
  };
}

export async function updatePlan(_state: PlanFormState, input: FormData): Promise<PlanFormState> {
  const id = Number(input.get("id"));
  const parsed = planInputSchema.safeParse({
    access_ends_at: input.get("access_ends_at"),
    access_starts_at: input.get("access_starts_at"),
    access_grace_days: input.get("access_grace_days"),
    cancellation_grace_days: input.get("cancellation_grace_days") ?? "2",
    category: input.get("category"),
    description: input.get("description"),
    duration_basis: input.get("duration_basis"),
    duration_days: input.get("duration_days"),
    duration_months: input.get("duration_months"),
    freeze_requires_approval: input.get("freeze_requires_approval"),
    is_unlimited_sessions: input.get("is_unlimited_sessions"),
    max_freeze_days: input.get("max_freeze_days"),
    min_freeze_days: input.get("min_freeze_days"),
    name: input.get("name"),
    price: input.get("price"),
    sessions_count: input.get("sessions_count"),
    type: input.get("type"),
    valid_from: input.get("valid_from"),
    valid_to: input.get("valid_to"),
  });

  const values = getFormValues(input);
  const commissionRules = parsePlanEmployeeRules(input);
  const initialRuleIds = parseInitialRuleIds(input);

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      message: "Invalid plan.",
      errors: {},
      values,
    };
  }

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid plan input.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await mutate(`/plans/${id}`, "PUT", {
      ...parsed.data,
      description: parsed.data.description ?? "",
      duration_months: parsed.data.duration_basis === "months" ? parsed.data.duration_months : null,
      price: String(parsed.data.price),
    });
    await syncPlanEmployeeRules(id, initialRuleIds, commissionRules);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update plan.",
      errors: {},
      values,
    };
  }

  return {
    ok: true,
    message: "Plan updated.",
    errors: {},
    values: {},
  };
}

function getFormValues(input: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(input.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}
export async function togglePlan(input: FormData): Promise<void> {
  await mutate(`/plans/${Number(input.get("id"))}/toggle`, "PATCH");
}

export async function deletePlan(input: FormData): Promise<void> {
  await mutate(`/plans/${Number(input.get("id"))}`, "DELETE");
}

async function mutate<T = unknown>(path: string, method: string, body?: Record<string, unknown>) {
  const response = await serverApiFetch<T>(path, {
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
    method,
  });

  revalidatePath("/dashboard/plans");
  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/academy");

  return response;
}

function parsePlanEmployeeRules(input: FormData) {
  const raw = String(input.get("employee_commission_rules") ?? "[]");
  const parsed = z.array(planEmployeeRuleSchema).safeParse(JSON.parse(raw));

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid employee commission rules.");
  }

  return parsed.data;
}

function parseInitialRuleIds(input: FormData) {
  const raw = String(input.get("initial_employee_commission_rule_ids") ?? "[]");
  const parsed = z.array(z.coerce.number().int().positive()).safeParse(JSON.parse(raw));

  if (!parsed.success) {
    return [];
  }

  return parsed.data;
}

async function syncPlanEmployeeRules(
  planId: number,
  initialRuleIds: number[],
  rules: Array<z.infer<typeof planEmployeeRuleSchema>>,
) {
  const currentRuleIds = rules.flatMap((rule) => (rule.id && rule.id > 0 ? [rule.id] : []));
  const deletedRuleIds = initialRuleIds.filter((ruleId) => !currentRuleIds.includes(ruleId));

  for (const rule of rules) {
    const path =
      rule.id && rule.id > 0
        ? `/employees/${rule.employee_id}/plan-commission-rules/${rule.id}`
        : `/employees/${rule.employee_id}/plan-commission-rules`;

    await serverApiFetch(path, {
      body: JSON.stringify({
        calculation_type: rule.calculation_type,
        is_active: rule.is_active,
        plan_id: planId,
        value: String(rule.value),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: rule.id && rule.id > 0 ? "PUT" : "POST",
    });
  }

  if (deletedRuleIds.length > 0) {
    await deleteRemovedRules(planId, deletedRuleIds);
  }
}

async function deleteRemovedRules(planId: number, ruleIds: number[]) {
  const employeesResponse = await serverApiFetch<
    Array<{
      id: number;
      plan_commission_rules?: Array<{
        id: number;
        plan_id: number | null;
      }>;
    }>
  >("/employees?filter[status]=active&per_page=100");

  for (const employee of employeesResponse.data) {
    for (const rule of employee.plan_commission_rules ?? []) {
      if (rule.plan_id !== planId || !ruleIds.includes(rule.id)) {
        continue;
      }

      await serverApiFetch(`/employees/${employee.id}/plan-commission-rules/${rule.id}`, {
        method: "DELETE",
      });
    }
  }
}

export async function createPlanCategoryAction(name: string, description?: string) {
  try {
    const res = await serverApiFetch<{ id: number; name: string; slug: string }>("/plan-categories", {
      body: JSON.stringify({ description, name }),
      method: "POST",
    });
    revalidatePath("/dashboard/plans");
    return { data: res.data, ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create category", ok: false };
  }
}
