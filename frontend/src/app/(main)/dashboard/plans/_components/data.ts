import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type PlanCommissionRuleRow = {
  id: number;
  employee_id: number;
  plan_id: number | null;
  calculation_type: "fixed" | "percentage";
  value: string;
  is_active: boolean;
};

export type PlanEmployeeOption = {
  id: number;
  name: string;
  role: string | null;
  plan_commission_rules?: PlanCommissionRuleRow[];
};

export type PlanRow = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  duration_days: number;
  duration_months: number | null;
  sessions_count: number | null;
  is_unlimited_sessions: boolean;
  type: string;
  category: string;
  is_active: boolean;
  is_sellable: boolean;
  valid_from: string | null;
  valid_to: string | null;
  access_starts_at: string | null;
  access_ends_at: string | null;
  max_freeze_days: number;
  access_grace_days: number;
  min_freeze_days: number;
  freeze_requires_approval: boolean;
  created_at: string | null;
  employee_commission_rules?: Array<{
    id: number;
    employee_id: number;
    plan_id: number | null;
    calculation_type: "fixed" | "percentage";
    value: string;
    is_active: boolean;
    employee?: {
      id: number;
      name: string;
      role: string | null;
    } | null;
  }>;
};

export type PlansPageData = {
  employees: PlanEmployeeOption[];
  plans: PlanRow[];
};

export async function getPlansPageData(): Promise<PlansPageData> {
  try {
    const [result, employeesResult] = await Promise.all([
      serverApiFetch<PlanRow[] | PaginatedData<PlanRow>>("/plans?sort=name&per_page=100"),
      serverApiFetch<PlanEmployeeOption[] | PaginatedData<PlanEmployeeOption>>(
        "/employees?filter[status]=active&per_page=100",
      ).catch(() => ({ data: [] as PlanEmployeeOption[] })),
    ]);

    return {
      employees: unwrapList(employeesResult.data as PlanEmployeeOption[] | PaginatedData<PlanEmployeeOption>),
      plans: unwrapList(result.data),
    };
  } catch {
    return { employees: [], plans: [] };
  }
}
