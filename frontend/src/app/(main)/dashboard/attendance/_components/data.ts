import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type AttendanceRecord = {
  id: number;
  employee_id: number;
  employee?: {
    id: number;
    name: string;
    role: string;
    attendance_code: string;
  };
  shift_id: number | null;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  scan_method: string | null;
  schedule_status: string | null;
  approval_status: string | null;
  notes: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  off_day_bonus_amount: string;
  check_in_location: {
    status: string | null;
    distance_meters: number | null;
  };
};

export type AttendanceSummary = {
  employee_id: number;
  name: string;
  role: string;
  month: string;
  records_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  off_day_count: number;
  late_minutes: number;
  early_leave_minutes: number;
  off_day_bonus_amount: string;
};

export type AttendanceViolation = {
  id: number;
  employee?: {
    name: string;
    role: string;
  };
  rule?: {
    id: number;
    code: string;
    name: string;
    description: string | null;
  };
  violation_date: string;
  type: string;
  minutes: number | null;
  deduction_days: string;
  deduction_amount: string;
  estimated_deduction_amount: string | null;
  status: string;
  notes: string | null;
};

export type EmployeeOption = {
  id: number;
  name: string;
  role: string;
  attendance_code: string | null;
  attendance_qr: string | null;
};

export type MemberAddonOption = {
  id: number;
  status?: string;
  sessions_remaining?: number | null;
  sessions_total?: number | null;
  plan?: {
    id?: number;
    name?: string | null;
    access_starts_at?: string | null;
    access_ends_at?: string | null;
  } | null;
};

export type MemberLookupOption = {
  id: number;
  name: string;
  phone: string | null;
  attendance_code: string | null;
  attendance_qr: string | null;
  latest_subscription?: {
    id?: number;
    plan_name?: string | null;
    status?: string;
    sessions_remaining?: number | null;
    sessions_total?: number | null;
    addons?: MemberAddonOption[];
  } | null;
};

export type EmployeeShift = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  grace_minutes: number;
  is_active: boolean;
};

export type MemberVisitStationRow = {
  id: number;
  member?: {
    id: number;
    name: string;
    phone: string;
    attendance_code: string | null;
  };
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  scan_method: string;
  alert_reason: string | null;
};

export type AttendanceWarningsQuery = {
  employeeId?: string;
  page?: string;
  perPage?: string;
  status?: string;
  type?: string;
};

export async function getAttendancePageData({
  date,
  month,
  warnings,
}: {
  date: string;
  month: string;
  warnings: AttendanceWarningsQuery;
}) {
  const warningParams = new URLSearchParams({
    page: warnings.page ?? "1",
    per_page: warnings.perPage ?? "10",
  });

  if (warnings.status) {
    warningParams.set("status", warnings.status);
  }

  if (warnings.type) {
    warningParams.set("type", warnings.type);
  }

  if (warnings.employeeId) {
    warningParams.set("employee_id", warnings.employeeId);
  }

  const [employees, members, memberVisits, records, shifts, summary, violations] = await Promise.all([
    safeFetch<EmployeeOption[] | PaginatedData<EmployeeOption>>("/attendance/employee-options?per_page=100", []),
    safeFetch<MemberLookupOption[] | PaginatedData<MemberLookupOption>>("/members?per_page=100", []),
    safeFetch<MemberVisitStationRow[] | PaginatedData<MemberVisitStationRow>>(
      `/member-visits?filter[from]=${encodeURIComponent(date)}&filter[to]=${encodeURIComponent(date)}&sort=-check_in_at&page=1&per_page=8`,
      [],
    ),
    safeFetch<AttendanceRecord[] | PaginatedData<AttendanceRecord>>(
      `/attendance?filter[date]=${encodeURIComponent(date)}&sort=-date&page=1&per_page=100`,
      [],
    ),
    safeFetch<EmployeeShift[]>("/attendance/shifts", []),
    safeFetch<AttendanceSummary[]>(`/attendance/summary?month=${encodeURIComponent(month)}`, []),
    safeFetch<AttendanceViolation[] | PaginatedData<AttendanceViolation>>(
      `/attendance/violations?${warningParams.toString()}`,
      [],
    ),
  ]);
  const violationsList = unwrapList(violations);

  return {
    employees: unwrapList(employees),
    members: unwrapList(members),
    memberVisits: unwrapList(memberVisits).slice(0, 8),
    records: unwrapList(records).slice(0, 12),
    shifts,
    summary,
    violations: violationsList,
    violationsMeta: paginationMeta(violations, violationsList.length),
  };
}

function paginationMeta<T>(payload: T[] | PaginatedData<T>, fallbackTotal: number): PaginationMeta {
  if (Array.isArray(payload)) {
    return {
      current_page: 1,
      last_page: 1,
      per_page: fallbackTotal,
      total: fallbackTotal,
    };
  }

  return {
    current_page: Number(payload.meta?.current_page ?? 1),
    last_page: Number(payload.meta?.last_page ?? 1),
    per_page: Number(payload.meta?.per_page ?? fallbackTotal),
    total: Number(payload.meta?.total ?? fallbackTotal),
  };
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const result = await serverApiFetch<T>(path);

    return result.data;
  } catch {
    return fallback;
  }
}
