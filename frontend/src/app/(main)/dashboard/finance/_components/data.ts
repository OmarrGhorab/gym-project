import { serverApiFetch } from "@/lib/api/server";

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

export async function getFinanceDashboardData(): Promise<FinanceDashboardData> {
  try {
    const result = await serverApiFetch<FinanceDashboardData>("/reports/finance-summary");

    return result.data;
  } catch {
    return emptyFinanceData;
  }
}
