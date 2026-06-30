import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type FinanceMoneySource = {
  key: string;
  label: string;
  amount: string;
  percentage: string;
};

export type FinanceChartPoint = {
  period: string;
  revenue: string;
  expenses: string;
  net_profit: string;
};

export type FinanceUpcomingItem = {
  id: number;
  title: string;
  description: string;
  amount: string;
};

export type FinanceDashboardData = {
  totals: {
    revenue_mtd: string;
    previous_revenue_mtd: string;
    expenses_mtd: string;
    previous_expenses_mtd: string;
    pending_payroll: string;
    outstanding_dues: string;
    outstanding_dues_count: number;
    net_profit_mtd: string;
    profit_margin: string;
    revenue_growth_rate: string;
    expense_growth_rate: string;
  };
  revenue_sources: FinanceMoneySource[];
  payment_methods: FinanceMoneySource[];
  chart: FinanceChartPoint[];
  upcoming: {
    dues: FinanceUpcomingItem[];
    pending_payroll: FinanceUpcomingItem[];
    recent_expenses: FinanceUpcomingItem[];
  };
};

export type FinancePayment = {
  id: number;
  amount: string;
  method: string;
  status: string;
  paid_at: string | null;
  due_date: string | null;
  created_by: number | null;
};

export type FinanceDue = {
  id: number;
  member_id?: number;
  member_name?: string;
  plan_name?: string;
  subscription_id?: number;
  amount_due?: string;
  outstanding_balance?: string;
  due_date?: string | null;
  status?: string;
};

export type FinanceExpense = {
  id: number;
  category: string;
  amount: string;
  description: string | null;
  date: string | null;
  creator?: {
    id: number;
    name: string;
  } | null;
  created_at: string | null;
};

export type FinancePageData = FinanceDashboardData & {
  duesLedger: FinanceDue[];
  expensesLedger: FinanceExpense[];
  paymentsLedger: FinancePayment[];
};

const emptyFinanceData: FinanceDashboardData = {
  totals: {
    revenue_mtd: "0.00",
    previous_revenue_mtd: "0.00",
    expenses_mtd: "0.00",
    previous_expenses_mtd: "0.00",
    pending_payroll: "0.00",
    outstanding_dues: "0.00",
    outstanding_dues_count: 0,
    net_profit_mtd: "0.00",
    profit_margin: "0.00",
    revenue_growth_rate: "0.00",
    expense_growth_rate: "0.00",
  },
  revenue_sources: [],
  payment_methods: [],
  chart: [],
  upcoming: {
    dues: [],
    pending_payroll: [],
    recent_expenses: [],
  },
};

export async function getFinanceDashboardData(
  from: string,
  to: string,
  groupBy: string,
): Promise<FinancePageData> {
  try {
    const [summaryResult, chartResult, paymentsResult, duesResult, expensesResult] = await Promise.all([
      serverApiFetch<FinanceDashboardData>("/reports/finance-summary"),
      serverApiFetch<FinanceChartPoint[]>(`/reports/financial?from=${from}&to=${to}&group_by=${groupBy}`),
      safeFetch<FinancePayment[] | PaginatedData<FinancePayment>>("/payments?page=1&per_page=15", []),
      safeFetch<FinanceDue[] | PaginatedData<FinanceDue>>("/payments/dues", []),
      safeFetch<FinanceExpense[] | PaginatedData<FinanceExpense>>("/expenses?sort=-date&page=1&per_page=15", []),
    ]);

    return {
      ...summaryResult.data,
      chart: chartResult.data,
      duesLedger: unwrapList(duesResult.data),
      expensesLedger: unwrapList(expensesResult.data),
      paymentsLedger: unwrapList(paymentsResult.data),
    };
  } catch {
    return {
      ...emptyFinanceData,
      duesLedger: [],
      expensesLedger: [],
      paymentsLedger: [],
    };
  }
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}
