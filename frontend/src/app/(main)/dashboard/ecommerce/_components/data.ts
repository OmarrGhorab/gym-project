import { serverApiFetch } from "@/lib/api/server";

export type PosPeriodFilter = "this-month" | "last-month" | "last-30-days" | "year-to-date";
export type PosPaymentMethodFilter = "pos" | "cash" | "card" | "bank_transfer";
export type PosDateRange = { from?: string; to?: string };

export type PosChartPoint = {
  date: string;
  revenue: string;
  orders: number;
};

export type PosHourlyPoint = {
  hour: string;
  revenue: string;
  orders: number;
};

export type PosPaymentMethod = {
  method: string;
  label: string;
  amount: string;
  count: number;
  percentage: string;
};

export type PosTopProduct = {
  id: number;
  name: string;
  category: string;
  units_sold: number;
  stock_quantity: number;
  share: string;
  sales: string;
};

export type PosStockAlert = {
  id: number;
  name: string;
  category: string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: "low" | "out";
};

export type PosRecentOrder = {
  id: string;
  date: string | null;
  customer: string;
  seller: string;
  payment_method: string;
  payment: "Paid" | "Pending";
  total: string;
  items: string;
  status: string;
};

export type PosProductOption = {
  id: number;
  name: string;
  price: string;
  stock_quantity: number;
};

export type PosMemberOption = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type ApiSaleResource = {
  id: number;
  created_at: string | null;
  member?: { name?: string | null } | null;
  sold_by?: { name?: string | null } | null;
  payment_method: string;
  payment?: { status?: string | null } | null;
  total: string | number;
  items?: Array<{
    quantity?: number | string | null;
    product?: { name?: string | null } | null;
  }>;
  status: string;
};

export type PosDashboardData = {
  generated_at: string;
  totals: {
    sales: string;
    sales_growth_rate: string;
    orders: number;
    orders_growth_rate: string;
    member_buyers: number;
    average_sale: string;
    low_stock_products: number;
    availability_rate: string;
  };
  sales_chart: PosChartPoint[];
  hourly_activity: PosHourlyPoint[];
  payment_methods: PosPaymentMethod[];
  top_products: {
    share_of_sales: string;
    categories: Array<{ name: string; share: string }>;
    products: PosTopProduct[];
  };
  inventory: {
    products_total: number;
    in_stock_products: number;
    low_stock_products: number;
    out_of_stock_products: number;
    units_available: number;
    inventory_value: string;
    availability_rate: string;
  };
  stock_alerts: PosStockAlert[];
  recent_orders: PosRecentOrder[];
  products: PosProductOption[];
  members: PosMemberOption[];
  daily_sales: {
    total_revenue: string;
    sales: unknown[];
  };
};

const emptyPosData: PosDashboardData = {
  generated_at: new Date().toISOString(),
  totals: {
    sales: "0.00",
    sales_growth_rate: "0.00",
    orders: 0,
    orders_growth_rate: "0.00",
    member_buyers: 0,
    average_sale: "0.00",
    low_stock_products: 0,
    availability_rate: "0",
  },
  sales_chart: [],
  hourly_activity: [],
  payment_methods: [],
  top_products: {
    share_of_sales: "0",
    categories: [],
    products: [],
  },
  inventory: {
    products_total: 0,
    in_stock_products: 0,
    low_stock_products: 0,
    out_of_stock_products: 0,
    units_available: 0,
    inventory_value: "0.00",
    availability_rate: "0",
  },
  stock_alerts: [],
  recent_orders: [],
  products: [],
  members: [],
  daily_sales: {
    total_revenue: "0.00",
    sales: [],
  },
};

export function normalizePosPeriodFilter(value: string | string[] | undefined): PosPeriodFilter {
  const period = Array.isArray(value) ? value[0] : value;

  if (period === "last-month" || period === "last-30-days" || period === "year-to-date") {
    return period;
  }

  return "this-month";
}

export function normalizePosPaymentMethodFilter(value: string | string[] | undefined): PosPaymentMethodFilter {
  const method = Array.isArray(value) ? value[0] : value;

  if (method === "cash" || method === "card" || method === "bank_transfer") {
    return method;
  }

  return "pos";
}

export function normalizePosDate(value: string | string[] | undefined): string | undefined {
  const date = Array.isArray(value) ? value[0] : value;

  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

export async function getPosDashboardData(
  filters: { dateRange?: PosDateRange; period?: PosPeriodFilter; paymentMethod?: PosPaymentMethodFilter } = {},
  access: { canCreateSale: boolean } = { canCreateSale: true },
): Promise<PosDashboardData> {
  try {
    const params = new URLSearchParams();

    params.set("period", filters.period ?? "this-month");
    params.set("payment_method", filters.paymentMethod ?? "pos");
    if (filters.dateRange?.from) params.set("from", filters.dateRange.from);
    if (filters.dateRange?.to) params.set("to", filters.dateRange.to);

    const salesDateRange = filters.dateRange?.from
      ? { from: filters.dateRange.from, to: filters.dateRange.to ?? filters.dateRange.from }
      : getPosPeriodDateRange(filters.period ?? "this-month");
    const salesParams = new URLSearchParams({
      "filter[created_from]": salesDateRange.from,
      "filter[created_to]": salesDateRange.to,
      per_page: "25",
      sort: "-created_at",
    });

    if (filters.paymentMethod && filters.paymentMethod !== "pos") {
      salesParams.set("filter[payment_method]", filters.paymentMethod);
    }

    const [result, productsResult, membersResult, dailySalesResult, recentSalesResult] = await Promise.all([
      safeFetch<PosDashboardData>(`/reports/pos-summary?${params.toString()}`, emptyPosData),
      access.canCreateSale
        ? safeFetch<PosProductOption[] | { data: PosProductOption[] }>(
            "/products?filter[is_active]=1&sort=name&per_page=100",
            [],
          )
        : { data: [] as PosProductOption[] },
      access.canCreateSale
        ? safeFetch<PosMemberOption[] | { data: PosMemberOption[] }>(
            "/members?filter[status]=active&sort=name&per_page=100",
            [],
          )
        : { data: [] as PosMemberOption[] },
      safeFetch<{ total_revenue: string; sales: unknown[] }>(`/sales/daily?date=${formatDateParam(new Date())}`, {
        total_revenue: "0.00",
        sales: [],
      }),
      safeFetch<ApiSaleResource[] | { data: ApiSaleResource[] }>(`/sales?${salesParams.toString()}`, []),
    ]);
    const recentSales = Array.isArray(recentSalesResult.data) ? recentSalesResult.data : recentSalesResult.data.data;

    return {
      ...emptyPosData,
      ...result.data,
      daily_sales: filters.dateRange?.from
        ? {
            total_revenue: result.data.totals.sales,
            sales: Array.from({ length: result.data.totals.orders }),
          }
        : dailySalesResult.data,
      recent_orders: recentSales.map(mapSaleToRecentOrder),
      products: Array.isArray(productsResult.data) ? productsResult.data : productsResult.data.data,
      members: Array.isArray(membersResult.data) ? membersResult.data : membersResult.data.data,
    };
  } catch {
    return emptyPosData;
  }
}

function mapSaleToRecentOrder(sale: ApiSaleResource): PosRecentOrder {
  return {
    id: `#${sale.id}`,
    date: sale.created_at,
    customer: sale.member?.name ?? "Walk-in",
    seller: sale.sold_by?.name ?? "Unknown",
    payment_method: sale.payment_method,
    payment: sale.payment?.status === "paid" ? "Paid" : "Pending",
    total: String(sale.total),
    items: formatSaleItems(sale.items ?? []),
    status: sale.status ? titleCase(sale.status) : "Unknown",
  };
}

function formatSaleItems(items: NonNullable<ApiSaleResource["items"]>) {
  if (items.length === 0) {
    return "0 items";
  }

  if (items.length === 1) {
    const item = items[0];
    const quantity = Number(item.quantity ?? 0);
    const productName = item.product?.name;

    return productName ? `${quantity} x ${productName}` : `${quantity} items`;
  }

  const quantity = items.reduce((total, item) => total + Number(item.quantity ?? 0), 0);

  return `${quantity} items`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getPosPeriodDateRange(period: PosPeriodFilter) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let to: Date;

  if (period === "last-month") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (period === "last-30-days") {
    from = new Date(startOfToday);
    from.setDate(startOfToday.getDate() - 29);
    to = startOfToday;
  } else if (period === "year-to-date") {
    from = new Date(now.getFullYear(), 0, 1);
    to = startOfToday;
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = startOfToday;
  }

  return {
    from: formatDateParam(from),
    to: formatDateParam(to),
  };
}

function formatDateParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}
