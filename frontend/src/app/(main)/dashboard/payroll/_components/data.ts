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
  absence_deductions: string;
  total_deductions: string;
  absence_count: number;
  absence_breakdown: Array<{
    attendance_id: number;
    date: string;
    reason: string;
    deduction_amount: string;
    recorded_by: string | null;
  }>;
  manual_bonus_reason: string | null;
  manual_deduction_reason: string | null;
  net_salary: string;
  status: string;
  paid_at: string | null;
};

export async function getPayrollPageData(month: string) {
  try {
    const result = await serverApiFetch<PayrollRow[] | PaginatedData<PayrollRow>>(
      `/payroll?month=${encodeURIComponent(month)}&per_page=100&sort=-created_at`,
    );

    return unwrapList(result.data);
  } catch {
    return [];
  }
}
