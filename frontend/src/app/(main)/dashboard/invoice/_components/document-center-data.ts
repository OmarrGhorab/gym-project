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
  deductions: string;
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
  absent_count: number;
  excused_count: number;
  open_count: number;
};

/** A day somebody checked into and never signed out of. */
type PendingAttendanceRow = {
  id: number;
};

type DocumentTotals = {
  members: number;
  payroll: number;
  pendingApprovals: number;
  sales: number;
};

export type DocumentCenterData = {
  attendance: {
    pendingApprovals: number;
    summary: DocumentAttendanceSummary[];
  };
  members: DocumentMemberRow[];
  payroll: DocumentPayrollRow[];
  sales: DocumentSaleRow[];
  totals: DocumentTotals;
};

export async function getDocumentCenterData(): Promise<DocumentCenterData> {
  const [payroll, sales, members, attendanceSummary, pendingAttendance] = await Promise.all([
    safePage<DocumentPayrollRow>("/payroll?sort=-created_at&page=1&per_page=10"),
    safePage<DocumentSaleRow>("/sales?sort=-created_at&page=1&per_page=10"),
    safePage<DocumentMemberRow>("/members?sort=-created_at&page=1&per_page=12"),
    safeData<DocumentAttendanceSummary[]>("/attendance/summary", []),
    safePage<PendingAttendanceRow>("/attendance?filter[open]=1&page=1&per_page=50"),
  ]);

  return {
    attendance: {
      pendingApprovals: pendingAttendance.total,
      summary: attendanceSummary.slice(0, 8),
    },
    members: members.rows,
    payroll: payroll.rows,
    sales: sales.rows,
    totals: {
      members: members.total,
      payroll: payroll.total,
      pendingApprovals: pendingAttendance.total,
      sales: sales.total,
    },
  };
}

async function safePage<T>(path: string): Promise<{ rows: T[]; total: number }> {
  try {
    const result = await serverApiFetch<T[] | PaginatedData<T>>(path);
    const rows = unwrapList(result.data);
    const metaTotal = typeof result.meta?.total === "number" ? result.meta.total : undefined;

    return {
      rows,
      total: metaTotal ?? rows.length,
    };
  } catch {
    return { rows: [], total: 0 };
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
