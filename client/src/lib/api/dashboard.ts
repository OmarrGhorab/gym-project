import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export type ApiEnvelope<T> = {
  data: T;
  message: string;
  meta?: Record<string, unknown>;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type DashboardSummary = {
  active_subscriptions: number;
  revenue_mtd: string;
  expiring_soon: number;
  sales_today: {
    count: number;
    revenue: string;
  };
  top_products: TopProduct[];
  captain_leaderboard: CaptainLeaderboardEntry[];
};

export type TopProduct = {
  product_id: number;
  name: string;
  sku: string;
  revenue: string;
  units_sold: number;
};

export type CaptainLeaderboardEntry = {
  employee_id: number;
  name: string;
  commissions_total: string;
};

export type Subscription = {
  id: number;
  status: string;
  start_date: string;
  end_date: string;
  price_paid: string;
  discount: string;
  member?: Member;
  plan?: Plan;
};

export type Member = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  status: string;
};

export type Plan = {
  id: number;
  name: string;
};

export type Notification = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type Sale = {
  id: number;
  total: string;
  status: string;
  payment_method: string;
  member?: Member;
  sold_by?: UserSummary;
  created_at: string;
};

export type DailySalesReport = {
  total_revenue: string;
  sales: Sale[];
};

export type UserSummary = {
  id: number;
  name: string;
  email: string;
};

export type Product = {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
};

export type FinancialReport = {
  data: FinancialReportRow[];
  meta: {
    from: string;
    to: string;
    group_by: string;
    totals: {
      revenue: string;
      expenses: string;
      net_profit: string;
    };
  };
};

export type FinancialReportRow = {
  period: string;
  revenue: string;
  expenses: string;
  net_profit: string;
};

type ApiErrorBody = {
  error?: {
    message?: string;
    code?: string;
    details?: Record<string, string[]>;
  };
  message?: string;
};

async function fetchEnvelope<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiEnvelope<T>> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as ApiEnvelope<T> & ApiErrorBody;

  if (!response.ok) {
    throw new Error(
      payload.error?.message || payload.message || response.statusText
    );
  }

  return payload;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const envelope = await fetchEnvelope<T>(path, options);
  return envelope.data;
}

function ensurePaginationMeta(
  meta: Record<string, unknown> | undefined
): PaginationMeta {
  return {
    current_page: Number(meta?.current_page ?? 0),
    per_page: Number(meta?.per_page ?? 0),
    total: Number(meta?.total ?? 0),
    last_page: Number(meta?.last_page ?? 0),
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return api<DashboardSummary>("/dashboard/summary");
}

export async function getDashboardExpiringSoon(
  page = 1
): Promise<Paginated<Subscription>> {
  const envelope = await fetchEnvelope<Subscription[]>(
    `/dashboard/expiring-soon?page=${page}`
  );
  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta),
  };
}

export async function getDashboardTopProducts(
  period: "today" | "week" | "month" = "week",
  limit = 5
): Promise<TopProduct[]> {
  return api<TopProduct[]>(
    `/dashboard/top-products?period=${period}&limit=${limit}`
  );
}

export async function getDashboardSalesToday(): Promise<{
  count: number;
  revenue: string;
}> {
  return api<{ count: number; revenue: string }>("/dashboard/sales-today");
}

export async function getNotifications(
  options: { unread?: boolean; limit?: number } = {}
): Promise<Paginated<Notification>> {
  const params = new URLSearchParams();
  if (options.unread) params.set("unread", "1");
  if (options.limit) params.set("per_page", String(options.limit));
  const envelope = await fetchEnvelope<Notification[]>(
    `/notifications?${params.toString()}`
  );
  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta),
  };
}

export async function getRecentSales(limit = 5): Promise<Paginated<Sale>> {
  const envelope = await fetchEnvelope<Sale[]>(
    `/sales?sort=-created_at&per_page=${limit}`
  );
  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta),
  };
}

export async function getDailySales(
  date: string
): Promise<DailySalesReport> {
  return api<DailySalesReport>(`/sales/daily?date=${date}`);
}

export async function getLowStockProducts(
  limit = 5
): Promise<Paginated<Product>> {
  const envelope = await fetchEnvelope<Product[]>(
    `/products?filter[is_low_stock]=1&per_page=${limit}`
  );
  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta),
  };
}

export async function getFinancialReport(
  from: string,
  to: string,
  groupBy: "day" | "month" = "day"
): Promise<FinancialReport> {
  const envelope = await fetchEnvelope<FinancialReportRow[]>(
    `/reports/financial?from=${from}&to=${to}&group_by=${groupBy}`
  );
  return {
    data: envelope.data,
    meta: {
      from: String(envelope.meta?.from ?? from),
      to: String(envelope.meta?.to ?? to),
      group_by: String(envelope.meta?.group_by ?? groupBy),
      totals: (envelope.meta?.totals ?? {
        revenue: "0.00",
        expenses: "0.00",
        net_profit: "0.00",
      }) as FinancialReport["meta"]["totals"],
    },
  };
}
