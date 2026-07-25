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

export type PlanCategoryOption = {
  id: number;
  name: string;
  slug: string;
  plan_scope: "gym_access" | "extra_service" | "fitness_studio";
  description: string | null;
  is_active: boolean;
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
  cancellation_grace_days: number;
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
  categories: PlanCategoryOption[];
  employees: PlanEmployeeOption[];
  plans: PlanRow[];
};

export type PlansQuery = {
  created_from?: string;
  created_to?: string;
  search?: string;
  status?: string;
  type?: string;
};

export async function getPlansPageData(query?: PlansQuery): Promise<PlansPageData> {
  try {
    const params = new URLSearchParams({ sort: "name", per_page: "100" });

    if (query?.search) {
      params.set("filter[search]", query.search);
    }

    if (query?.type && query.type !== "all") {
      params.set("filter[type]", query.type);
    }

    if (query?.status && query.status !== "all") {
      params.set("filter[is_active]", query.status === "active" ? "1" : "0");
    }
    if (query?.created_from) params.set("filter[created_from]", query.created_from);
    if (query?.created_to) params.set("filter[created_to]", query.created_to);

    const [result, employeesResult, categoriesResult] = await Promise.all([
      serverApiFetch<PlanRow[] | PaginatedData<PlanRow>>(`/plans?${params.toString()}`),
      serverApiFetch<PlanEmployeeOption[] | PaginatedData<PlanEmployeeOption>>(
        "/employees?filter[status]=active&per_page=100",
      ).catch(() => ({ data: [] as PlanEmployeeOption[] })),
      serverApiFetch<PlanCategoryOption[]>("/plan-categories").catch(() => ({ data: [] as PlanCategoryOption[] })),
    ]);

    return {
      categories: Array.isArray(categoriesResult.data) ? categoriesResult.data : [],
      employees: unwrapList(employeesResult.data as PlanEmployeeOption[] | PaginatedData<PlanEmployeeOption>),
      plans: unwrapList(result.data),
    };
  } catch {
    return { categories: [], employees: [], plans: [] };
  }
}
