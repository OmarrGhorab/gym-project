import { serverApiFetch } from "@/lib/api/server";

export type PosPeriodFilter = "this-month" | "last-month" | "last-30-days" | "year-to-date";
export type PosPaymentMethodFilter = "pos" | "cash" | "card" | "bank_transfer";

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

export async function getPosDashboardData(filters: {
  period?: PosPeriodFilter;
  paymentMethod?: PosPaymentMethodFilter;
} = {}): Promise<PosDashboardData> {
  try {
    const params = new URLSearchParams();

    params.set("period", filters.period ?? "this-month");
    params.set("payment_method", filters.paymentMethod ?? "pos");

    const result = await serverApiFetch<PosDashboardData>(`/reports/pos-summary?${params.toString()}`);

    return result.data;
  } catch {
    return emptyPosData;
  }
}
