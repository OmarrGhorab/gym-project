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
  total_amount?: string;
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
  attendance_code?: string | null;
  attendance_qr?: string | null;
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
  updated_at?: string;
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

export type Attendance = {
  id: number;
  employee_id: number;
  employee?: {
    id: number;
    name?: string | null;
    role?: string | null;
    attendance_code?: string | null;
  } | null;
  shift_id?: number | null;
  shift?: EmployeeShift | null;
  date: string;
  check_in?: string | null;
  check_in_location?: ScanLocation | null;
  check_out?: string | null;
  check_out_location?: ScanLocation | null;
  status: "present" | "absent" | "late" | "excused" | string;
  scan_method?: string | null;
  schedule_status?: string | null;
  approval_status?: string | null;
  late_minutes?: number;
  early_leave_minutes?: number;
  notes?: string | null;
  created_at?: string | null;
};

export type AttendanceSummary = {
  employee_id: number;
  shift_id?: number | null;
  name: string;
  role?: string | null;
  month: string;
  records_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  late_minutes?: number;
  early_leave_minutes?: number;
};

export type EmployeeShift = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  grace_minutes: number;
  is_active: boolean;
};

export type ScanLocation = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  distance_meters?: number | null;
  status?: "inside" | "outside" | "missing" | "unconfigured" | string | null;
};

export type AttendanceViolation = {
  id: number;
  employee_id: number;
  employee?: {
    id: number;
    name?: string | null;
    role?: string | null;
  } | null;
  attendance_id?: number | null;
  payroll_id?: number | null;
  violation_date?: string | null;
  type: string;
  minutes?: number | null;
  deduction_days: string;
  deduction_amount: string;
  status: "pending" | "approved" | "dismissed" | "auto_applied" | string;
  notes?: string | null;
  created_at?: string | null;
};

export type AttendanceViolationRule = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  threshold_minutes?: number | null;
  deduction_days: string;
  requires_admin_approval: boolean;
  auto_apply_if_unreviewed: boolean;
  is_active: boolean;
  updated_at?: string | null;
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
  attendance_deductions: string;
  attendance_snapshot?: {
    total?: string;
    violations?: AttendanceViolation[];
  } | null;
  net_salary: string;
  status: string;
  paid_at?: string | null;
};

export type Commission = {
  id: number;
  employee_id: number;
  source: {
    type: string;
    id: number;
  };
  rate: string;
  amount: string;
  month: string;
  status: string;
  created_at?: string | null;
};

export type CommissionBackfillResult = {
  processed?: number;
  created?: number;
  skipped?: number;
  dry_run?: boolean;
  [key: string]: unknown;
};

export type ExportStatus = {
  export_id: string;
  status: string;
  resource?: string;
  format?: string;
  download_url?: string;
};

export type Sale = {
  id: number;
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
  email?: string;
  roles?: string[];
};

export type Employee = {
  id: number;
  user_id?: number | null;
  name: string;
  phone?: string;
  attendance_code?: string | null;
  attendance_qr?: string | null;
  role: string;
  base_salary: string;
  commission_rate: string;
  shift_id?: number | null;
  shift?: EmployeeShift | null;
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
  sales_volume?: string;
  subscriptions_count: number;
  attendance_count?: number;
  commissions_earned: string;
  previous_sales_count?: number;
  previous_sales_volume?: string;
  previous_subscriptions_count?: number;
  previous_commissions_earned?: string;
  comparison?: {
    sales_count_delta: number;
    subscriptions_count_delta: number;
    commissions_delta: string;
    sales_volume_delta: string;
  };
};

export type SalesPeriodReportRow = {
  date?: string;
  sale_id?: number;
  created_at?: string;
  member_id?: number | null;
  member_name?: string | null;
  product_id?: number;
  product_name?: string;
  product_sku?: string;
  sold_by_user_id?: number;
  cashier_name?: string;
  quantity?: number;
  unit_price?: string;
  line_total?: string;
  sale_total?: string;
  payment_method?: string;
  revenue?: string;
  sales_count?: number;
  units_sold?: number;
};

export type SalesPeriodReport = {
  data: SalesPeriodReportRow[];
  meta?: {
    next_cursor?: string | null;
    prev_cursor?: string | null;
    path?: string;
    per_page?: number;
  };
};

export type MemberPaymentHistory = {
  member: {
    id: number;
    name: string;
    phone?: string | null;
  };
  totals: {
    subscription_total: string;
    subscription_paid: string;
    product_paid: string;
    total_paid: string;
    outstanding_balance: string;
  };
  subscription_payments: {
    id: number;
    subscription_id: number;
    plan_name?: string | null;
    amount: string;
    method: string;
    status: string;
    paid_at?: string | null;
    due_date?: string | null;
  }[];
  product_purchases: {
    id: number;
    total: string;
    payment_method: string;
    status: string;
    sold_by?: string | null;
    created_at?: string | null;
    items: {
      product_id: number;
      product_name?: string | null;
      quantity: number;
      unit_price: string;
      total: string;
    }[];
  }[];
};

export type MemberVisit = {
  id: number;
  member_id: number;
  member?: {
    id: number;
    name?: string | null;
    phone?: string | null;
    attendance_code?: string | null;
  } | null;
  subscription_id?: number | null;
  subscription?: {
    id?: number | null;
    plan_name?: string | null;
    status?: string | null;
    end_date?: string | null;
  } | null;
  check_in_at: string;
  check_in_location?: ScanLocation | null;
  check_out_at?: string | null;
  check_out_location?: ScanLocation | null;
  status: "allowed" | "blocked" | "flagged" | string;
  scan_method?: string | null;
  alert_reason?: string | null;
  notes?: string | null;
  creator?: UserSummary | null;
  created_at?: string | null;
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

export type AppSettings = {
  gym: {
    name: string;
    colors: {
      primary: string;
      secondary: string;
    };
    logo?: string | null;
  };
  reminder_days: number;
  currency: string;
  vat_rate: number;
  receipt_template: string;
  attendance: {
    gym_latitude?: number | null;
    gym_longitude?: number | null;
    gym_radius_meters: number;
    default_grace_minutes: number;
  };
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

export async function getSettings(): Promise<AppSettings> {
  return api<AppSettings>("/settings");
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
  if (options.page) params.set("page", String(options.page));

  const envelope = await fetchEnvelope<PaymentDue[]>(
    `/payments/dues?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getExpenses(options: {
  page?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
  sort?: "date" | "-date" | "amount" | "-amount" | "created_at" | "-created_at";
} = {}): Promise<Paginated<Expense>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
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
      current_page: Number(envelope.meta?.current_page) || 1,
      per_page: Number(envelope.meta?.per_page) || envelope.data.length,
      total: Number(envelope.meta?.total) || envelope.data.length,
      last_page: Number(envelope.meta?.last_page) || 1,
      total_amount: String(envelope.meta?.total_amount ?? "0.00"),
    },
  };
}

export async function getAttendance(options: {
  page?: number;
  employeeId?: string;
  status?: string;
  date?: string;
  from?: string;
  to?: string;
  sort?: "date" | "-date" | "check_in" | "-check_in" | "created_at" | "-created_at";
} = {}): Promise<Paginated<Attendance>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.employeeId) params.set("filter[employee_id]", options.employeeId);
  if (options.status) params.set("filter[status]", options.status);
  if (options.date) params.set("filter[date]", options.date);
  if (options.from) params.set("filter[from]", options.from);
  if (options.to) params.set("filter[to]", options.to);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<Attendance[]>(
    `/attendance?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getAttendanceSummary(options: {
  month?: string;
  employeeId?: string;
} = {}): Promise<AttendanceSummary[]> {
  const params = new URLSearchParams();
  if (options.month) params.set("month", options.month);
  if (options.employeeId) params.set("employee_id", options.employeeId);

  return api<AttendanceSummary[]>(`/attendance/summary?${params.toString()}`);
}

export async function getEmployeeShifts(): Promise<EmployeeShift[]> {
  return api<EmployeeShift[]>("/attendance/shifts");
}

export async function getAttendanceViolations(options: {
  page?: number;
  status?: string;
  employeeId?: string;
} = {}): Promise<Paginated<AttendanceViolation>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.status) params.set("status", options.status);
  if (options.employeeId) params.set("employee_id", options.employeeId);

  const envelope = await fetchEnvelope<AttendanceViolation[]>(
    `/attendance/violations?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
  };
}

export async function getAttendanceViolationRules(): Promise<AttendanceViolationRule[]> {
  return api<AttendanceViolationRule[]>("/attendance/violation-rules");
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

export async function getCommissions(options: {
  employeeId: string;
  page?: number;
  month?: string;
  status?: string;
}): Promise<Paginated<Commission> & { total_amount: string }> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.month) params.set("month", options.month);
  if (options.status) params.set("status", options.status);

  const envelope = await fetchEnvelope<Commission[]>(
    `/employees/${options.employeeId}/commissions?${params.toString()}`
  );

  return {
    data: envelope.data,
    meta: ensurePaginationMeta(envelope.meta, envelope.data.length),
    total_amount: String(envelope.meta?.total_amount ?? "0.00"),
  };
}

export async function getSalesPeriodReport(options: {
  from: string;
  to: string;
  groupBy?: "day" | "product" | "cashier" | "transaction";
  sellerId?: string;
  productId?: string;
}): Promise<SalesPeriodReport> {
  const params = new URLSearchParams({
    from: options.from,
    to: options.to,
    group_by: options.groupBy ?? "day",
  });
  if (options.sellerId) params.set("seller_id", options.sellerId);
  if (options.productId) params.set("product_id", options.productId);

  const envelope = await fetchEnvelope<SalesPeriodReportRow[] | SalesPeriodReport>(
    `/sales/report?${params.toString()}`
  );
  const reportData = Array.isArray(envelope.data)
    ? envelope.data
    : envelope.data.data;
  const reportMeta = Array.isArray(envelope.data)
    ? envelope.meta
    : envelope.data.meta ?? envelope.meta;

  return {
    data: reportData,
    meta: reportMeta as SalesPeriodReport["meta"],
  };
}

export async function getMemberPaymentHistory(
  memberId: number
): Promise<MemberPaymentHistory | null> {
  try {
    return api<MemberPaymentHistory>(`/members/${memberId}/payment-history`);
  } catch {
    return null;
  }
}

export async function getMemberVisits(options: {
  page?: number;
  memberId?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: "check_in_at" | "-check_in_at" | "created_at" | "-created_at";
} = {}): Promise<Paginated<MemberVisit>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.memberId) params.set("filter[member_id]", options.memberId);
  if (options.status) params.set("filter[status]", options.status);
  if (options.from) params.set("filter[from]", options.from);
  if (options.to) params.set("filter[to]", options.to);
  if (options.sort) params.set("sort", options.sort);

  const envelope = await fetchEnvelope<MemberVisit[]>(
    `/member-visits?${params.toString()}`
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
  soldByUserId?: string;
  sort?: "created_at" | "-created_at" | "total" | "-total" | "subtotal" | "-subtotal";
} = {}): Promise<Paginated<Sale>> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.status) params.set("filter[status]", options.status);
  if (options.paymentMethod) params.set("filter[payment_method]", options.paymentMethod);
  if (options.memberId) params.set("filter[member_id]", options.memberId);
  if (options.soldByUserId) params.set("filter[sold_by_user_id]", options.soldByUserId);
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

export async function getEmployee(id: number | string): Promise<Employee | null> {
  try {
    const envelope = await fetchEnvelope<Employee>(`/employees/${id}`, {
      cache: "no-store",
    });
    return envelope.data;
  } catch {
    return null;
  }
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

export async function getSingleEmployeePerformance(
  employeeId: number | string,
  options: {
    from?: string;
    to?: string;
  } = {}
): Promise<EmployeePerformance | null> {
  const params = new URLSearchParams();
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);

  try {
    return api<EmployeePerformance>(
      `/employees/${employeeId}/performance?${params.toString()}`
    );
  } catch {
    return null;
  }
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

export async function getAllMembers(options: Omit<Parameters<typeof getMembers>[0], "page"> = {}): Promise<Member[]> {
  const firstPage = await getMembers({ ...options, page: 1 });
  const members = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.last_page; page++) {
    const result = await getMembers({ ...options, page });
    members.push(...result.data);
  }

  return members;
}

export async function getPlans(): Promise<Plan[]> {
  const envelope = await fetchEnvelope<Plan[]>("/plans?per_page=100");
  return envelope.data;
}

export async function getPlan(id: number | string): Promise<Plan> {
  const envelope = await fetchEnvelope<Plan>(`/plans/${id}`);
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
