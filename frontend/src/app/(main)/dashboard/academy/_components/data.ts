import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";
import { type DashboardSettings, type EmployeeShift, emptyWhatsAppAutoEvents } from "../../settings/_components/data";

export type StaffAcademyKpi = {
  label: string;
  value: number | string;
  detail: string;
  trend: string | null;
};

export type StaffAcademyShift = {
  id: number;
  name: string;
  date: string;
  staff_count: number;
  staff_names: string[];
};

export type StaffAcademyAttendanceException = {
  label: string;
  pending: number;
  reviewed: number;
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
  pos_sales_volume?: string;
  subscriptions_sold?: number;
  exceptions_count: number;
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
  attendance_exceptions: StaffAcademyAttendanceException[];
  performance_highlights: StaffAcademyPerformance[];
  upcoming_events: StaffAcademyEvent[];
  today: {
    checked_in: number;
    absent: number;
    still_in: number;
  };
};

export const emptyStaffAcademyData: StaffAcademyData = {
  generated_at: new Date().toISOString(),
  kpis: [],
  performance_highlights: [],
  shift_schedule: [],
  today: {
    checked_in: 0,
    absent: 0,
    still_in: 0,
  },
  attendance_exceptions: [],
  upcoming_events: [],
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

export type AcademyEmployeePlanCommissionRule = {
  id: number;
  employee_id: number;
  plan_id: number | null;
  calculation_type: "fixed" | "percentage";
  value: string;
  is_active: boolean;
};

export type AcademyEmployee = {
  id: number;
  user_id: number | null;
  name: string;
  phone: string | null;
  role: string;
  base_salary: string;
  pay_day: number | null;
  hire_date: string | null;
  status: "active" | "inactive";
  shift?: {
    id: number;
    name: string;
  } | null;
  attendance_code?: string | null;
  attendance_qr?: string | null;
  plan_commission_rules?: AcademyEmployeePlanCommissionRule[];
};

export type StaffAcademyPageData = {
  employeeRows: Array<{
    employee: AcademyEmployee;
    performance: StaffAcademyPerformance | null;
    commissions: Array<{
      id: number;
      amount: string;
    }>;
  }>;
};

export type ShiftOption = {
  id: number;
  name: string;
};

export type UserOption = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

export type AccessRole = {
  id: number;
  name: string;
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

  return safeFetch<StaffAcademyData>(`/reports/staff-academy${suffix}`, emptyStaffAcademyData);
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

export async function getStaffManagementPageData(): Promise<{
  employees: AcademyEmployee[];
  settings: DashboardSettings;
  shifts: EmployeeShift[];
  users: UserOption[];
}> {
  const [employees, settings, shifts, users] = await Promise.all([
    safeFetch<AcademyEmployee[] | PaginatedData<AcademyEmployee>>("/employees?per_page=100", []),
    safeFetch<DashboardSettings>("/settings", {
      attendance: {
            gym_latitude: null,
        gym_longitude: null,
        gym_radius_meters: 150,
      },
      currency: "EGP",
      gym: {
        colors: {
          primary: "#000000",
          secondary: "#ffffff",
        },
        logo: null,
        name: "ATP Gym",
      },
      payroll: {
        default_pay_day: 30,
        schedule_mode: "fixed",
      },
      shifts: {
        require_cash_count: false,
        handover_auto_accept: false,
        handover_auto_accept_on_match_only: true,
        require_handover_to_open: false,
      },
      receipt_template: "default",
      reminder_days: [7],
      vat_rate: 14,
      whatsapp: { templates: {}, auto_send: false, auto_events: emptyWhatsAppAutoEvents },
    }),
    safeFetch<EmployeeShift[]>("/attendance/shifts/manage", []).then(async (managed) => {
      if (managed.length > 0) {
        return managed;
      }

      return safeFetch<EmployeeShift[]>("/attendance/shifts", []);
    }),
    safeFetch<UserOption[]>("/employees/user-options", []),
  ]);

  return {
    employees: unwrapMaybeList(employees),
    settings,
    shifts,
    users: unwrapMaybeList(users),
  };
}

function unwrapMaybeList<T>(value: T[] | PaginatedData<T>): T[] {
  return unwrapList(value);
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const result = await serverApiFetch<T>(path);

    return result.data;
  } catch {
    return fallback;
  }
}
