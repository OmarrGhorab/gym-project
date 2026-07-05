import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type AttendanceRecord = {
  id: number;
  employee_id: number;
  employee?: {
    id: number;
    name: string;
    role: string;
    attendance_code: string;
  };
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  scan_method: string | null;
  schedule_status: string | null;
  approval_status: string | null;
  late_minutes: number;
  early_leave_minutes: number;
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
  late_minutes: number;
  early_leave_minutes: number;
};

export type AttendanceViolation = {
  id: number;
  employee?: {
    name: string;
    role: string;
  };
  violation_date: string;
  type: string;
  minutes: number | null;
  deduction_amount: string;
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

export async function getAttendancePageData({ date, month }: { date: string; month: string }) {
  const [employees, memberVisits, records, shifts, summary, violations] = await Promise.all([
    safeFetch<EmployeeOption[] | PaginatedData<EmployeeOption>>("/employees?filter[status]=active&per_page=100", []),
    safeFetch<MemberVisitStationRow[] | PaginatedData<MemberVisitStationRow>>(
      "/member-visits?sort=-check_in_at&page=1&per_page=8",
      [],
    ),
    safeFetch<AttendanceRecord[] | PaginatedData<AttendanceRecord>>(
      `/attendance?filter[date]=${encodeURIComponent(date)}&sort=-date&page=1&per_page=100`,
      [],
    ),
    safeFetch<EmployeeShift[]>("/attendance/shifts", []),
    safeFetch<AttendanceSummary[]>(`/attendance/summary?month=${encodeURIComponent(month)}`, []),
    safeFetch<AttendanceViolation[] | PaginatedData<AttendanceViolation>>("/attendance/violations?status=pending", []),
  ]);

  return {
    employees: unwrapList(employees),
    memberVisits: unwrapList(memberVisits).slice(0, 8),
    records: unwrapList(records).slice(0, 12),
    shifts,
    summary,
    violations: unwrapList(violations).slice(0, 12),
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
