import { serverApiFetch } from "@/lib/api/server";

/** A figure that has a person's name against it. */
export type DailyReportStaffRow = {
  user_id: number | null;
  name: string;
  collected: string;
  spent: string;
  payment_count: number;
  expense_count: number;
};

export type DailyReportPayment = {
  id: number;
  time: string | null;
  amount: string;
  method: string;
  source: string;
  status: string;
  recorded_by: string;
  shift: string | null;
};

export type DailyReportExpense = {
  id: number;
  time: string | null;
  amount: string;
  category: string | null;
  description: string | null;
  recorded_by: string;
};

export type DailyReportShift = {
  id: number;
  shift: string | null;
  staff: string;
  closed_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  status: string;
  opening_float: string;
  expected_cash: string | null;
  counted_cash: string | null;
  variance: string | null;
};

export type DailyReportAttendanceRow = {
  employee_id: number;
  name: string;
  role: string | null;
  shift: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  notes: string | null;
};

export type DailyReport = {
  business_date: string;
  window: { from: string; to: string };
  generated_at: string | null;
  money: {
    collections: string;
    refunds: string;
    expenses: string;
    net: string;
    by_method: { cash: string; card: string; bank: string };
    by_source: { subscriptions: string; addons: string; pos: string; other: string };
    expenses_by_category: Record<string, string>;
    payment_count: number;
    expense_count: number;
  };
  by_staff: DailyReportStaffRow[];
  payments: DailyReportPayment[];
  expenses: DailyReportExpense[];
  shifts: DailyReportShift[];
  attendance: {
    rows: DailyReportAttendanceRow[];
    totals: {
      employees: number;
      present: number;
      absent: number;
      late: number;
      no_scan: number;
      still_in: number;
    };
  };
  memberships: {
    count: number;
    rows: Array<{
      id: number;
      time: string | null;
      member: string | null;
      plan: string | null;
      price: string;
      sold_by: string;
    }>;
  };
};

/**
 * A day with nothing in it.
 *
 * Rendered when the request fails as well as when the gym genuinely traded
 * nothing — an empty report reads honestly in both cases, where a crashed page
 * would only look broken.
 */
export function emptyDailyReport(businessDate: string): DailyReport {
  return {
    business_date: businessDate,
    window: { from: "", to: "" },
    generated_at: null,
    money: {
      collections: "0.00",
      refunds: "0.00",
      expenses: "0.00",
      net: "0.00",
      by_method: { cash: "0.00", card: "0.00", bank: "0.00" },
      by_source: { subscriptions: "0.00", addons: "0.00", pos: "0.00", other: "0.00" },
      expenses_by_category: {},
      payment_count: 0,
      expense_count: 0,
    },
    by_staff: [],
    payments: [],
    expenses: [],
    shifts: [],
    attendance: {
      rows: [],
      totals: { employees: 0, present: 0, absent: 0, late: 0, no_scan: 0, still_in: 0 },
    },
    memberships: { count: 0, rows: [] },
  };
}

export async function getDailyReport(date?: string): Promise<DailyReport> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";

  try {
    const result = await serverApiFetch<DailyReport>(`/reports/daily${query}`);

    return result.data;
  } catch {
    return emptyDailyReport(date ?? "");
  }
}
