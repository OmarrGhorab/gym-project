import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type PayrollRow = {
  id: number;
  employee: {
    id: number;
    name: string | null;
    role: string | null;
    pay_day: number | null;
  };
  month: string;
  base_salary: string;
  commissions_total: string;
  bonuses: string;
  deductions: string;
  attendance_deductions: string;
  net_salary: string;
  status: string;
  paid_at: string | null;
};

export async function getPayrollPageData(month: string) {
  try {
    const result = await serverApiFetch<PayrollRow[] | PaginatedData<PayrollRow>>(
      `/payroll?month=${encodeURIComponent(month)}&sort=-created_at&page=1`,
    );

    return unwrapList(result.data);
  } catch {
    return [];
  }
}
