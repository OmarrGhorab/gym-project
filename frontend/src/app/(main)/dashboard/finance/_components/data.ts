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
  id?: number;
  member_id?: number;
  member_name?: string;
  plan_name?: string;
  subscription_id?: number;
  amount_due?: string;
  outstanding_balance?: string;
  due_date?: string | null;
  status?: string;
  subscription?: {
    id?: number | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  };
  member?: {
    id?: number | null;
    name?: string | null;
  };
  balance?: string;
  paid_total?: string;
  price_paid?: string;
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

export type FinanceShiftSession = {
  id: number;
  status: string;
  opening_float: string;
  expected_cash: string | null;
  expected_card: string | null;
  expected_bank: string | null;
  expected_expenses: string | null;
  expected_net: string | null;
  counted_cash: string | null;
  counted_card: string | null;
  counted_bank: string | null;
  counted_expenses: string | null;
  variance_notes?: string | null;
  variance?: {
    cash?: { expected: string | null; counted: string | null; variance: string | null };
    card?: { expected: string | null; counted: string | null; variance: string | null };
    bank?: { expected: string | null; counted: string | null; variance: string | null };
    expenses?: { expected: string | null; counted: string | null; variance: string | null };
  } | null;
  live_totals?: {
    cash: string;
    card: string;
    bank: string;
    expenses: string;
    net: string;
    opening_float?: string;
    collections?: string;
    refunds?: string;
    payment_count?: number;
    expense_count?: number;
    by_method?: {
      cash: string;
      card: string;
      bank: string;
    };
    by_source?: {
      subscriptions: string;
      addons: string;
      pos: string;
      other: string;
      refunds: string;
      expenses?: string;
    };
  } | null;
  shift?: { id: number; name: string; starts_at?: string; ends_at?: string } | null;
  previous_session_id?: number | null;
  opened_by?: { id: number; name: string } | null;
  closed_by?: { id: number; name: string } | null;
};

export type FinancePageData = FinanceDashboardData & {
  duesLedger: FinanceDue[];
  expensesLedger: FinanceExpense[];
  paymentsLedger: FinancePayment[];
  shiftDesk: {
    current: FinanceShiftSession | null;
    pending: FinanceShiftSession[];
    shifts: Array<{ id: number; name: string }>;
    requireHandoverToOpen: boolean;
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

export async function getFinanceDashboardData(
  from: string,
  to: string,
  groupBy: string,
  access: {
    canCollectDue: boolean;
    canViewExpenses: boolean;
    canViewPayments: boolean;
    canViewReports: boolean;
  },
): Promise<FinancePageData> {
  const summaryParams = new URLSearchParams({
    from,
    group_by: groupBy,
    to,
  });

  const [
    summaryResult,
    chartResult,
    paymentsResult,
    duesResult,
    expensesResult,
    currentSession,
    pendingSessions,
    shifts,
    settings,
  ] = await Promise.all([
    access.canViewReports
      ? safeFetch<FinanceDashboardData>(`/reports/finance-summary?${summaryParams.toString()}`, emptyFinanceData)
      : { data: emptyFinanceData },
    access.canViewReports
      ? safeFetch<FinanceChartPoint[]>(`/reports/financial?from=${from}&to=${to}&group_by=${groupBy}`, [])
      : { data: [] },
    access.canViewPayments
      ? safeFetch<FinancePayment[] | PaginatedData<FinancePayment>>("/payments?page=1&per_page=15", [])
      : { data: [] },
    access.canViewPayments || access.canCollectDue
      ? safeFetch<FinanceDue[] | PaginatedData<FinanceDue>>("/payments/dues", [])
      : { data: [] },
    access.canViewExpenses
      ? safeFetch<FinanceExpense[] | PaginatedData<FinanceExpense>>("/expenses?sort=-date&page=1&per_page=15", [])
      : { data: [] },
    access.canViewExpenses || access.canViewPayments || access.canCollectDue
      ? safeFetch<FinanceShiftSession | null>("/shift-sessions/current", null)
      : { data: null },
    access.canViewExpenses || access.canViewPayments || access.canCollectDue
      ? safeFetch<FinanceShiftSession[] | PaginatedData<FinanceShiftSession>>(
          "/shift-sessions?status=pending_admin&per_page=10",
          [],
        )
      : { data: [] },
    access.canViewExpenses || access.canViewPayments || access.canCollectDue
      ? safeFetch<Array<{ id: number; name: string }> | PaginatedData<{ id: number; name: string }>>(
          "/shift-sessions/options",
          [],
        )
      : { data: [] },
    access.canViewExpenses || access.canViewPayments || access.canCollectDue
      ? safeFetch<{
          shifts?: {
            require_handover_to_open?: boolean;
          };
        }>("/settings", {})
      : { data: {} },
  ]);

  const pendingHandover =
    access.canViewExpenses || access.canViewPayments || access.canCollectDue
      ? await safeFetch<FinanceShiftSession[] | PaginatedData<FinanceShiftSession>>(
          "/shift-sessions?status=pending_handover&per_page=10",
          [],
        )
      : { data: [] };

  const pending = [...unwrapList(pendingSessions.data), ...unwrapList(pendingHandover.data)];
  const shiftOptions = unwrapList(shifts.data).map((shift) => ({
    id: Number(shift.id),
    name: String(shift.name ?? `Shift #${shift.id}`),
  }));

  const summary = summaryResult.data ?? emptyFinanceData;
  const totals = { ...emptyFinanceData.totals, ...(summary.totals ?? {}) };
  const upcoming = {
    dues: Array.isArray(summary.upcoming?.dues) ? summary.upcoming.dues : [],
    pending_payroll: Array.isArray(summary.upcoming?.pending_payroll) ? summary.upcoming.pending_payroll : [],
    recent_expenses: Array.isArray(summary.upcoming?.recent_expenses) ? summary.upcoming.recent_expenses : [],
  };

  return {
    ...emptyFinanceData,
    ...summary,
    totals,
    upcoming,
    revenue_sources: Array.isArray(summary.revenue_sources) ? summary.revenue_sources : [],
    payment_methods: Array.isArray(summary.payment_methods) ? summary.payment_methods : [],
    chart: Array.isArray(chartResult.data) ? chartResult.data : [],
    duesLedger: unwrapList(duesResult.data).map(normalizeDue),
    expensesLedger: unwrapList(expensesResult.data),
    paymentsLedger: unwrapList(paymentsResult.data),
    shiftDesk: {
      current: normalizeCurrentSession(currentSession.data),
      pending,
      shifts: shiftOptions,
      requireHandoverToOpen: Boolean(
        settings.data && "shifts" in settings.data ? settings.data.shifts?.require_handover_to_open : false,
      ),
    },
  };
}

/** API sometimes encodes JSON null as {} — treat empty objects as no open session. */
function normalizeCurrentSession(
  value: FinanceShiftSession | null | undefined | Record<string, never>,
): FinanceShiftSession | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const id = Number((value as FinanceShiftSession).id);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return value as FinanceShiftSession;
}

function normalizeDue(due: FinanceDue): FinanceDue {
  return {
    ...due,
    id: due.id ?? due.subscription?.id ?? undefined,
    member_id: due.member_id ?? due.member?.id ?? undefined,
    member_name: due.member_name ?? due.member?.name ?? undefined,
    subscription_id: due.subscription_id ?? due.subscription?.id ?? undefined,
    outstanding_balance: due.outstanding_balance ?? due.balance,
    amount_due: due.amount_due ?? due.price_paid,
    due_date: due.due_date ?? due.subscription?.end_date ?? undefined,
    status: due.status ?? due.subscription?.status ?? undefined,
  };
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}
