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

export type CursorPaginationMeta = {
  next_cursor?: string | null;
  prev_cursor?: string | null;
  per_page: number;
  total_amount?: string;
};

export type CursorPaginated<T> = {
  data: T[];
  meta: CursorPaginationMeta;
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
  last_reminded_on?: string | null;
  member?: Member;
  plan?: Plan;
  sold_by?: UserSummary;
  created_at?: string;
};

export type Member = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  status: string;
  gender?: string;
  national_id?: string;
  join_date?: string;
  expiry_date?: string;
  notes?: string;
  total_paid?: string;
  has_photo?: boolean;
  latest_subscription?: {
    id: number;
    plan_name: string;
    start_date?: string;
    end_date: string;
    status: string;
  } | null;
};

export type Plan = {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  duration_days: number;
  sessions_count?: number | null;
  type: "membership" | "offer";
  is_active: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  max_freeze_days: number;
  is_sellable: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Notification = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type Payment = {
  id: number;
  amount: string;
  method: string;
  status: string;
  paid_at?: string | null;
  due_date?: string | null;
  created_by?: number | null;
};

export type PaymentDue = {
  subscription: {
    id: number;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
  };
  member: {
    id?: number | null;
    name?: string | null;
  };
  balance: string;
  paid_total: string;
  price_paid: string;
};

export type Expense = {
  id: number;
  category: string;
  amount: string;
  description?: string | null;
  date?: string | null;
  creator?: UserSummary | null;
  created_at?: string | null;
};

export type Payroll = {
  id: number;
  employee: {
    id: number;
    name?: string | null;
    role?: string | null;
  };
  month: string;
  base_salary: string;
  commissions_total: string;
  bonuses: string;
  deductions: string;
  net_salary: string;
  status: string;
  paid_at?: string | null;
};

export type Sale = {
  id: number;
  idempotency_key?: string;
  member_id?: number | null;
  sold_by_user_id?: number | null;
  subtotal?: string;
  discount?: string;
  total: string;
  status: string;
  payment_method: string;
  notes?: string | null;
  items?: SaleItem[];
  payment?: Record<string, unknown> | null;
  member?: Member;
  sold_by?: UserSummary;
  created_at: string;
  updated_at?: string;
};

export type SaleItem = {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
  total: string;
  product?: Product;
  created_at?: string;
  updated_at?: string;
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

export type Employee = {
  id: number;
  name: string;
  phone?: string;
  role: string;
  base_salary: string;
  commission_rate: string;
  hire_date?: string;
  status: string;
  user?: UserSummary | null;
  created_at?: string;
};

export type EmployeePerformance = {
  employee_id: number;
  name: string;
  role: string;
  sales_count: number;
  subscriptions_count: number;
  commissions_earned: string;
};

export type Product = {
  id: number;
  name: string;
  category: string;
  sku: string;
  price: string;
  cost: string;
  stock_quantity: number;
  low_stock_threshold: number;
  image?: string | null;
  image_url?: string | null;
  is_active: boolean;
  is_low_stock: boolean;
  created_at?: string;
  updated_at?: string;
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

export type Role = {
  id: number;
  name: string;
  is_preset: boolean;
  permissions: string[];
};

export type PermissionCatalog = Record<string, string[]>;

export type AuditLog = {
  id: number;
  action: string;
  description: string;
  subject: {
    type: string;
    id: number;
  } | null;
  causer: {
    id: number;
    name: string;
  } | null;
  causer_type: "user" | "system" | string;
  changes: Record<string, unknown>;
  properties: Record<string, unknown>;
  created_at: string;
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
    cache: options.cache ?? "no-store",
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
  meta: Record<string, unknown> | undefined,
  fallbackTotal = 0
): PaginationMeta {
  const paginationMeta =
    (meta?.pagination as Record<string, unknown> | undefined) ??
    (meta?.page as Record<string, unknown> | undefined) ??
    meta;

  return {
    current_page: toFiniteNumber(
      paginationMeta?.current_page ?? paginationMeta?.currentPage,
      1
    ),
    per_page: toFiniteNumber(
      paginationMeta?.per_page ?? paginationMeta?.perPage,
      fallbackTotal
    ),
    total: toFiniteNumber(paginationMeta?.total, fallbackTotal),
    last_page: toFiniteNumber(
      paginationMeta?.last_page ?? paginationMeta?.lastPage,
      1
    ),
  };
}

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getSubscriptions(options: {
  page?: number;
  status?: string;
  memberId?: string;
  sort?: "created_at" | "-created_at" | "start_date" | "-start_date" | "end_date" | "-end_date";
} = {}): Promise<Paginated<Subscription>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.status) params.set("filter[status]", options.status);
  if (options.memberId) params.set("filter[member_id]", options.memberId);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<Subscription[]>(
    `/subscriptions?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getAllSubscriptions(options: Omit<Parameters<typeof getSubscriptions>[0], "page"> = {}): Promise<Subscription[]> {
  const firstPage = await getSubscriptions({ ...options, page: 1 });
  const subscriptions = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.last_page; page++) {
    const result = await getSubscriptions({ ...options, page });
    subscriptions.push(...result.data);
  }

  return subscriptions;
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
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getNotificationsPaginated(options: {
  page?: number;
  unread?: string;
} = {}): Promise<Paginated<Notification>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.unread) params.set("unread", options.unread);

  const envelope = await fetchEnvelope<Notification[]>(
    `/notifications?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getPayments(options: {
  page?: number;
  status?: "paid" | "partial";
} = {}): Promise<Paginated<Payment>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.status) params.set("status", options.status);

  const envelope = await fetchEnvelope<Payment[]>(
    `/payments?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getPaymentDues(options: {
  page?: number;
} = {}): Promise<Paginated<PaymentDue>> {
  const params = new URLSearchParams();
  params.set("status", "due");
  if (options.page) params.set("page", String(options.page));

  const envelope = await fetchEnvelope<PaymentDue[]>(
    `/payments?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getExpenses(options: {
  cursor?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  sort?: "date" | "-date" | "amount" | "-amount" | "created_at" | "-created_at";
} = {}): Promise<CursorPaginated<Expense>> {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.category) params.set("filter[category]", options.category);
  if (options.startDate) params.set("filter[start_date]", options.startDate);
  if (options.endDate) params.set("filter[end_date]", options.endDate);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<Expense[]>(
    `/expenses?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: {
      next_cursor: String(envelope.meta?.next_cursor ?? "") || null,
      prev_cursor: String(envelope.meta?.prev_cursor ?? "") || null,
      per_page: toFiniteNumber(envelope.meta?.per_page, envelope.data.length),
      total_amount: String(envelope.meta?.total_amount ?? "0.00"),
    },
  };
}

export async function getPayroll(options: {
  page?: number;
  month?: string;
  status?: "pending" | "paid";
  employeeId?: string;
} = {}): Promise<Paginated<Payroll>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.month) params.set("month", options.month);
  if (options.status) params.set("status", options.status);
  if (options.employeeId) params.set("employee_id", options.employeeId);

  const envelope = await fetchEnvelope<Payroll[]>(
    `/payroll?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getRecentSales(limit = 5): Promise<Paginated<Sale>> {
  const envelope = await fetchEnvelope<Sale[]>(
    `/sales?sort=-created_at&per_page=${limit}`
  );
  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getSales(options: {
  page?: number;
  status?: string;
  paymentMethod?: string;
  memberId?: string;
  sort?: "created_at" | "-created_at" | "total" | "-total" | "subtotal" | "-subtotal";
} = {}): Promise<Paginated<Sale>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.status) params.set("filter[status]", options.status);
  if (options.paymentMethod) params.set("filter[payment_method]", options.paymentMethod);
  if (options.memberId) params.set("filter[member_id]", options.memberId);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<Sale[]>(
    `/sales?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getAllSales(options: Omit<Parameters<typeof getSales>[0], "page"> = {}): Promise<Sale[]> {
  const firstPage = await getSales({ ...options, page: 1 });
  const sales = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.last_page; page++) {
    const result = await getSales({ ...options, page });
    sales.push(...result.data);
  }

  return sales;
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
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getProducts(options: {
  page?: number;
  search?: string;
  category?: string;
  isActive?: string;
  isLowStock?: boolean;
  sort?: "name" | "-name" | "price" | "-price" | "stock_quantity" | "-stock_quantity" | "created_at" | "-created_at";
  perPage?: number;
} = {}): Promise<Paginated<Product>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.search) params.set("filter[search]", options.search);
  if (options.category) params.set("filter[category]", options.category);
  if (options.isActive) params.set("filter[is_active]", options.isActive);
  if (options.isLowStock) params.set("filter[is_low_stock]", "1");
  if (options.sort) params.set("sort", options.sort);
  if (options.perPage) params.set("per_page", String(options.perPage));

  const envelope = await fetchEnvelope<Product[]>(
    `/products?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getAllProducts(options: Omit<Parameters<typeof getProducts>[0], "page"> = {}): Promise<Product[]> {
  const firstPage = await getProducts({ ...options, page: 1 });
  const products = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.last_page; page++) {
    const result = await getProducts({ ...options, page });
    products.push(...result.data);
  }

  return products;
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

export async function getRoles(): Promise<Role[]> {
  const envelope = await fetchEnvelope<Role[]>("/roles");
  return envelope.data;
}

export async function getPermissions(): Promise<PermissionCatalog> {
  const envelope = await fetchEnvelope<PermissionCatalog>("/permissions");
  return envelope.data;
}

export async function getAuditLogs(options: {
  page?: number;
  from?: string;
  to?: string;
  subject?: string;
  causer?: string;
  sort?: "created_at" | "-created_at";
} = {}): Promise<Paginated<AuditLog>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.from) params.set("filter[from]", options.from);
  if (options.to) params.set("filter[to]", options.to);
  if (options.subject) params.set("filter[subject]", options.subject);
  if (options.causer) params.set("filter[causer]", options.causer);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<AuditLog[]>(
    `/audit-logs?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getEmployees(options: {
  page?: number;
  role?: string;
  status?: string;
  search?: string;
  sort?: "name" | "-name" | "role" | "-role" | "status" | "-status" | "created_at" | "-created_at";
} = {}): Promise<Paginated<Employee>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.role) params.set("filter[role]", options.role);
  if (options.status) params.set("filter[status]", options.status);
  if (options.search) params.set("filter[q]", options.search);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<Employee[]>(
    `/employees?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getEmployeePerformance(options: {
  from?: string;
  to?: string;
} = {}): Promise<EmployeePerformance[]> {
  const params = new URLSearchParams();
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);

  const envelope = await fetchEnvelope<EmployeePerformance[]>(
    `/reports/employees?${params.toString()}`
  );

  return envelope.data;
}

export async function getMembers(options: {
  page?: number;
  search?: string;
  status?: string;
  gender?: string;
  planId?: string;
} = {}): Promise<Paginated<Member>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.search) params.set("filter[search]", options.search);
  if (options.status) params.set("filter[status]", options.status);
  if (options.gender) params.set("filter[gender]", options.gender);
  if (options.planId) params.set("filter[plan_id]", options.planId);

  const envelope = await fetchEnvelope<Member[]>(
    `/members?${params.toString()}`
  );
  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getPlans(): Promise<Plan[]> {
  const envelope = await fetchEnvelope<Plan[]>("/plans?per_page=100");
  return envelope.data;
}

export async function getPlansPaginated(options: {
  page?: number;
  type?: string;
  isActive?: string;
  sort?: "name" | "-name" | "price" | "-price" | "duration_days" | "-duration_days" | "created_at" | "-created_at";
} = {}): Promise<Paginated<Plan>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.type) params.set("filter[type]", options.type);
  if (options.isActive) params.set("filter[is_active]", options.isActive);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<Plan[]>(
    `/plans?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getAllPlans(options: Omit<Parameters<typeof getPlansPaginated>[0], "page"> = {}): Promise<Plan[]> {
  const firstPage = await getPlansPaginated({ ...options, page: 1 });
  const plans = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.last_page; page++) {
    const result = await getPlansPaginated({ ...options, page });
    plans.push(...result.data);
  }

  return plans;
}

export async function getMember(id: number): Promise<Member | null> {
  try {
    const envelope = await fetchEnvelope<Member>(`/members/${id}`, {
      cache: "no-store",
    });
    return envelope.data;
  } catch {
    return null;
  }
}
