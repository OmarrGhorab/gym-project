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
  attendance_count?: number;
  previous_period?: {
    subscriptions_sold?: number;
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
  users: AccessUser[];
  roles: AccessRole[];
};

export async function getStaffAcademyData(): Promise<StaffAcademyPageData> {
  const [reportResult, employeesResult, shiftsResult, usersResult, rolesResult] = await Promise.all([
    serverApiFetch<StaffAcademyData>("/reports/staff-academy"),
    safeFetch<AcademyEmployee[] | PaginatedData<AcademyEmployee>>("/employees?status=active&per_page=100", []),
    safeFetch<StaffAcademyPageData["shifts"]>("/attendance/shifts", []),
    safeFetch<AccessUser[] | PaginatedData<AccessUser>>("/users?sort=name&per_page=100", []),
    safeFetch<AccessRole[]>("/roles", []),
  ]);
  const employees = unwrapList(employeesResult.data);
  const employeeRows = await Promise.all(
    employees.map(async (employee) => {
      const [performanceResult, commissionsResult] = await Promise.all([
        safeFetch<AcademyPerformanceDetail | null>(`/employees/${employee.id}/performance`, null),
        safeFetch<AcademyCommission[] | PaginatedData<AcademyCommission>>(
          `/employees/${employee.id}/commissions?per_page=5`,
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
