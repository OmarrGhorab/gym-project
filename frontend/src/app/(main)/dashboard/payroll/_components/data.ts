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
  attendance_snapshot: {
    manual_bonus_reason?: string;
    manual_deduction_reason?: string;
  } | null;
  net_salary: string;
  status: string;
  paid_at: string | null;
};

/** An approved overtime bonus still waiting to be typed into a salary by hand. */
export type OvertimeBonusRow = {
  id: number;
  employee_id: number;
  employee?: { id: number; name: string | null; role: string | null } | null;
  covering_for?: { id: number; name: string | null } | null;
  shift?: { id: number; name: string } | null;
  date: string;
  hours: string | null;
  bonus_amount: string;
  status: string;
  notes: string | null;
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

export async function getApprovedOvertimeBonuses(month: string) {
  try {
    const result = await serverApiFetch<OvertimeBonusRow[] | PaginatedData<OvertimeBonusRow>>(
      `/overtime-shifts?month=${encodeURIComponent(month)}&status=approved&per_page=100`,
    );

    return unwrapList(result.data);
  } catch {
    return [];
  }
}
