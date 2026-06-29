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
  start: number;
  duration: number;
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
  name: string;
  phone: string | null;
  attendance_code: string | null;
  attendance_qr: string | null;
  role: string;
  base_salary: string;
  commission_rate: string;
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

export type StaffAcademyPageData = StaffAcademyData & {
  employeeRows: {
    commissions: AcademyCommission[];
    employee: AcademyEmployee;
    performance: AcademyPerformanceDetail | null;
  }[];
};

const emptyStaffAcademyData: StaffAcademyData = {
  generated_at: new Date().toISOString(),
  kpis: [
    { detail: "employees and captains in service", label: "Active Staff", trend: null, value: 0 },
    { detail: "0 attended this month", label: "Staff Attendance", trend: null, value: "0.0%" },
    { detail: "needs admin decision", label: "Warnings Pending", trend: null, value: 0 },
    { detail: "pending salary receipts", label: "Payroll Receipts", trend: null, value: 0 },
  ],
  shift_schedule: [],
  warning_status: [
    { approved: 0, auto_applied: 0, label: "Late", pending: 0 },
    { approved: 0, auto_applied: 0, label: "Absence", pending: 0 },
    { approved: 0, auto_applied: 0, label: "Off shift", pending: 0 },
  ],
  performance_highlights: [],
  upcoming_events: [],
  today: {
    checked_in: 0,
    late: 0,
    off_shift: 0,
    pending_approval: 0,
  },
};

export async function getStaffAcademyData(): Promise<StaffAcademyPageData> {
  try {
    const [reportResult, employeesResult] = await Promise.all([
      serverApiFetch<StaffAcademyData>("/reports/staff-academy"),
      safeFetch<AcademyEmployee[] | PaginatedData<AcademyEmployee>>("/employees?status=active&per_page=8", []),
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
    };
  } catch {
    return { ...emptyStaffAcademyData, employeeRows: [] };
  }
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}
