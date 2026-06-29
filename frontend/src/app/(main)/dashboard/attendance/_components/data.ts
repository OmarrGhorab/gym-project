import { serverApiFetch } from "@/lib/api/server";

import { unwrapList, type PaginatedData } from "../../_lib/api";

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

export async function getAttendancePageData() {
  const [records, summary, violations] = await Promise.all([
    safeFetch<AttendanceRecord[] | PaginatedData<AttendanceRecord>>("/attendance?sort=-date&page=1", []),
    safeFetch<AttendanceSummary[]>("/attendance/summary", []),
    safeFetch<AttendanceViolation[] | PaginatedData<AttendanceViolation>>("/attendance/violations?status=pending", []),
  ]);

  return {
    records: unwrapList(records).slice(0, 12),
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
