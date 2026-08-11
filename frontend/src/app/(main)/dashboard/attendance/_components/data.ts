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
  shift_id: number | null;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  scan_method: string | null;
  notes: string | null;
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
  absent_count: number;
  excused_count: number;
  open_count: number;
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
  is_active: boolean;
};

export type MemberVisitStationRow = {
  id: number;
  member?: {
    id: number;
    name: string;
    phone: string;
    attendance_code: string | null;
    /** Allowed + flagged check-ins in the month of the day being viewed. */
    visits_this_month: number | null;
  };
  /** The plan the visit was read against, falling back to the member's latest. */
  plan_name: string | null;
  plan_end_date: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  scan_method: string;
  alert_reason: string | null;
};

export async function getAttendancePageData({ date, month }: { date: string; month: string }) {
  const [employees, members, memberVisits, records, shifts, summary] = await Promise.all([
    safeFetch<EmployeeOption[] | PaginatedData<EmployeeOption>>("/attendance/employee-options?per_page=100", []),
    safeFetch<MemberLookupOption[] | PaginatedData<MemberLookupOption>>("/members?per_page=100", []),
    safeFetch<MemberVisitStationRow[] | PaginatedData<MemberVisitStationRow>>(
      // Every visit of the day, not a preview: 100 is the API's per_page ceiling and
      // comfortably above a full day's check-ins.
      `/member-visits?filter[from]=${encodeURIComponent(date)}&filter[to]=${encodeURIComponent(date)}&sort=-check_in_at&page=1&per_page=100`,
      [],
    ),
    safeFetch<AttendanceRecord[] | PaginatedData<AttendanceRecord>>(
      `/attendance?filter[date]=${encodeURIComponent(date)}&sort=-date&page=1&per_page=100`,
      [],
    ),
    safeFetch<EmployeeShift[]>("/attendance/shifts", []),
    safeFetch<AttendanceSummary[]>(`/attendance/summary?month=${encodeURIComponent(month)}`, []),
  ]);

  return {
    employees: unwrapList(employees),
    members: unwrapList(members),
    memberVisits: unwrapList(memberVisits),
    records: unwrapList(records).slice(0, 12),
    shifts,
    summary,
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
