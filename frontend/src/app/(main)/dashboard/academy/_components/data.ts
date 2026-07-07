import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type StaffAcademyKpi = {
  label: string;
  value: number | string;
  detail: string;
  trend: string | null;
};

export type StaffAcademyShift = {
  id: number;
  name: string;
  time: string;
  date: string;
  staff_count: number;
  grace_minutes: number;
  status: "completed" | "in_progress" | "upcoming";
};

export type StaffAcademyWarningStatus = {
  label: string;
  approved: number;
  pending: number;
  auto_applied: number;
};

export type StaffAcademyPerformance = {
  employee_id: number;
  name: string;
  role: string;
  initials: string;
  score: number;
  attendance_count: number;
  commissions_total: string;
  coached_services_count?: number;
  coached_services_revenue?: string;
  warnings_count: number;
};

export type StaffAcademyEvent = {
  id: string;
  date: string | null;
  title: string;
  time: string;
  type: string;
};

export type StaffAcademyData = {
  generated_at: string;
  period?: {
    from: string;
    to: string;
  };
  kpis: StaffAcademyKpi[];
  shift_schedule: StaffAcademyShift[];
  warning_status: StaffAcademyWarningStatus[];
  performance_highlights: StaffAcademyPerformance[];
  upcoming_events: StaffAcademyEvent[];
  today: {
    checked_in: number;
    late: number;
    off_shift: number;
    pending_approval: number;
  };
};

export type AcademyEmployee = {
  id: number;
  user_id?: number | null;
  name: string;
  phone: string | null;
  attendance_code: string | null;
  attendance_qr: string | null;
  role: string;
  base_salary: string;
  commission_rate: string;
  hire_date?: string | null;
  shift?: {
    id: number;
    name: string;
    starts_at: string;
    ends_at: string;
    grace_minutes: number;
  } | null;
  status: string;
  plan_commission_rules?: AcademyEmployeePlanCommissionRule[];
};

export type AcademyEmployeePlanCommissionRule = {
  id: number;
  employee_id: number;
  plan_id: number | null;
  plan?: {
    id: number | null;
    name: string | null;
    price: string | null;
  } | null;
  calculation_type: "fixed" | "percentage";
  value: string;
  is_active: boolean;
};

export type AcademyCommission = {
  id: number;
  employee_id: number;
  amount: string;
  month: string;
  rate: string;
  status: string;
  source: {
    type: string;
    id: number;
  };
};

export type AcademyPerformanceDetail = {
  employee?: {
    id: number;
    name: string;
    role: string;
  };
  subscriptions_sold?: number;
  pos_sales_volume?: string;
  commissions_total?: string;
  coached_services_count?: number;
  coached_services_revenue?: string;
  attendance_count?: number;
  previous_period?: {
    subscriptions_sold?: number;
    coached_services_count?: number;
    coached_services_revenue?: string;
    pos_sales_volume?: string;
    commissions_total?: string;
    attendance_count?: number;
  };
};

export type AccessUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

export type AccessRole = {
  id: number;
  name: string;
};

export type StaffAcademyPageData = StaffAcademyData & {
  employeeRows: {
    commissions: AcademyCommission[];
    employee: AcademyEmployee;
    performance: AcademyPerformanceDetail | null;
  }[];
  shifts: {
    id: number;
    name: string;
    starts_at: string;
    ends_at: string;
  }[];
  plans: {
    id: number;
    name: string;
    price: string;
  }[];
  users: AccessUser[];
  roles: AccessRole[];
};

export async function getStaffAcademyData(params: { from?: string; to?: string } = {}): Promise<StaffAcademyPageData> {
  const periodParams = new URLSearchParams();

  if (params.from) {
    periodParams.set("from", params.from);
  }

  if (params.to) {
    periodParams.set("to", params.to);
  }

  const periodQuery = periodParams.toString();
  const suffix = periodQuery ? `?${periodQuery}` : "";
  const [reportResult, employeesResult, shiftsResult, usersResult, rolesResult, plansResult] = await Promise.all([
    serverApiFetch<StaffAcademyData>(`/reports/staff-academy${suffix}`),
    safeFetch<AcademyEmployee[] | PaginatedData<AcademyEmployee>>("/employees?status=active&per_page=100", []),
    safeFetch<StaffAcademyPageData["shifts"]>("/attendance/shifts", []),
    safeFetch<AccessUser[] | PaginatedData<AccessUser>>("/users?sort=name&per_page=100", []),
    safeFetch<AccessRole[]>("/roles", []),
    safeFetch<StaffAcademyPageData["plans"] | PaginatedData<StaffAcademyPageData["plans"][number]>>(
      "/plans?filter[is_active]=1&sort=name&per_page=100",
      [],
    ),
  ]);
  const employees = unwrapList(employeesResult.data);
  const employeeRows = await Promise.all(
    employees.map(async (employee) => {
      const [performanceResult, commissionsResult] = await Promise.all([
        safeFetch<AcademyPerformanceDetail | null>(`/employees/${employee.id}/performance${suffix}`, null),
        safeFetch<AcademyCommission[] | PaginatedData<AcademyCommission>>(
          `/employees/${employee.id}/commissions?per_page=5${periodQuery ? `&${periodQuery}` : ""}`,
          [],
        ),
      ]);

      return {
        commissions: unwrapList(commissionsResult.data),
        employee,
        performance: performanceResult.data,
      };
    }),
  );

  return {
    ...reportResult.data,
    employeeRows,
    plans: unwrapList(plansResult.data),
    shifts: shiftsResult.data,
    users: unwrapList(usersResult.data),
    roles: rolesResult.data,
  };
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}
