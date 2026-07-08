import { serverApiFetch } from "@/lib/api/server";

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
  staff_names: string[];
  grace_minutes: number;
  status: "completed" | "in_progress" | "upcoming";
};

export type StaffAcademyWarningStatus = {
  label: string;
  warning: number;
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

export type PayrollSettings = {
  payroll?: {
    default_pay_day: number;
    schedule_mode: "fixed" | "per_employee";
  };
};

export type AcademyEmployeePayDay = {
  id: number;
  name: string;
  role: string;
  pay_day: number | null;
};

export async function getStaffAcademyData(params: { from?: string; to?: string } = {}): Promise<StaffAcademyData> {
  const periodParams = new URLSearchParams();

  if (params.from) {
    periodParams.set("from", params.from);
  }

  if (params.to) {
    periodParams.set("to", params.to);
  }

  const periodQuery = periodParams.toString();
  const suffix = periodQuery ? `?${periodQuery}` : "";

  return (await serverApiFetch<StaffAcademyData>(`/reports/staff-academy${suffix}`)).data;
}

export async function getAcademyEmployees(): Promise<AcademyEmployeePayDay[]> {
  try {
    const result = await serverApiFetch<AcademyEmployeePayDay[] | { data?: AcademyEmployeePayDay[] }>(
      "/employees?filter[status]=active&per_page=100",
    );
    const payload = result.data;

    return Array.isArray(payload) ? payload : (payload.data ?? []);
  } catch {
    return [];
  }
}

export async function getPayrollSettings(): Promise<PayrollSettings["payroll"] | null> {
  try {
    const result = await serverApiFetch<PayrollSettings>("/settings");

    return result.data.payroll ?? null;
  } catch {
    return null;
  }
}
