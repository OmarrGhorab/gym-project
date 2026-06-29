import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type DocumentPayrollRow = {
  id: number;
  employee: {
    id: number;
    name: string | null;
    role: string | null;
  };
  month: string;
  base_salary: string;
  attendance_deductions: string;
  net_salary: string;
  status: string;
  paid_at: string | null;
};

export type DocumentSaleRow = {
  id: number;
  member_id: number | null;
  total: string;
  payment_method: string;
  status: string;
  member?: {
    id: number;
    name: string | null;
    phone: string | null;
  } | null;
  sold_by?: {
    id: number;
    name: string | null;
  } | null;
  created_at: string | null;
};

export type DocumentMemberRow = {
  id: number;
  name: string;
  phone: string;
  status: string;
  attendance_code: string | null;
  attendance_qr: string | null;
  latest_subscription: {
    plan_name: string | null;
    end_date: string | null;
    status: string;
  } | null;
};

export type DocumentAttendanceSummary = {
  employee_id: number;
  name: string;
  role: string;
  month: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  late_minutes: number;
};

type AttendanceViolation = {
  id: number;
  status: string;
};

export type DocumentCenterData = {
  attendance: {
    pendingViolations: number;
    summary: DocumentAttendanceSummary[];
  };
  members: DocumentMemberRow[];
  payroll: DocumentPayrollRow[];
  sales: DocumentSaleRow[];
};

export async function getDocumentCenterData(): Promise<DocumentCenterData> {
  const [payroll, sales, members, attendanceSummary, attendanceViolations] = await Promise.all([
    safeList<DocumentPayrollRow>("/payroll?sort=-created_at&page=1&per_page=10"),
    safeList<DocumentSaleRow>("/sales?sort=-created_at&page=1&per_page=10"),
    safeList<DocumentMemberRow>("/members?sort=-created_at&page=1&per_page=12"),
    safeData<DocumentAttendanceSummary[]>("/attendance/summary", []),
    safeList<AttendanceViolation>("/attendance/violations?status=pending&page=1&per_page=50"),
  ]);

  return {
    attendance: {
      pendingViolations: attendanceViolations.length,
      summary: attendanceSummary.slice(0, 8),
    },
    members,
    payroll,
    sales,
  };
}

async function safeList<T>(path: string): Promise<T[]> {
  try {
    const result = await serverApiFetch<T[] | PaginatedData<T>>(path);

    return unwrapList(result.data);
  } catch {
    return [];
  }
}

async function safeData<T>(path: string, fallback: T): Promise<T> {
  try {
    const result = await serverApiFetch<T>(path);

    return result.data;
  } catch {
    return fallback;
  }
}
