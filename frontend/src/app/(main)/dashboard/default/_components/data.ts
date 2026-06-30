import { subDays } from "date-fns";

import { serverApiFetch } from "@/lib/api/server";

import type { SalesChartPoint } from "./performance-overview";
import type { RecentCustomerRow } from "./recent-customers-table/schema";

export type DashboardSummary = {
  active_subscriptions: number;
  revenue_mtd: string;
  revenue_growth_rate?: string;
  new_members_this_month?: number;
  new_members_previous_month?: number;
  new_members_growth_rate?: string;
  expiring_soon: number;
  sales_today: {
    count: number;
    revenue: string;
  };
  top_products: unknown[];
  captain_leaderboard: unknown[];
};

type MemberResource = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  join_date?: string | null;
  created_at?: string | null;
  total_paid?: string | null;
  latest_subscription?: {
    plan_name?: string | null;
    status?: string | null;
    end_date?: string | null;
  } | null;
};

type PaginatedData<T> = {
  data?: T[];
  total?: number;
};

type SalesReportDay = {
  date: string;
  revenue: string;
  sales_count: number;
  units_sold: number;
};

export type DefaultDashboardData = {
  summary: DashboardSummary;
  members: RecentCustomerRow[];
  membersTotal: number;
  salesChart: SalesChartPoint[];
};

export async function getDefaultDashboardData(): Promise<DefaultDashboardData> {
  const to = new Date();
  const from = subDays(to, 364);
  const dateParams = new URLSearchParams({
    from: formatDate(from),
    to: formatDate(to),
    group_by: "day",
  });

  const [summaryResult, membersResult, salesReportResult] = await Promise.all([
    serverApiFetch<DashboardSummary>("/dashboard/summary"),
    serverApiFetch<MemberResource[] | PaginatedData<MemberResource>>("/members?sort=-created_at&page=1"),
    serverApiFetch<SalesReportDay[] | PaginatedData<SalesReportDay>>(`/sales/report?${dateParams.toString()}`),
  ]);

  const members = unwrapList(membersResult.data);
  const salesReport = unwrapList(salesReportResult.data);

  return {
    summary: summaryResult.data,
    members: members.map(mapMemberToRow),
    membersTotal: getMetaTotal(membersResult.meta) ?? getPaginatedTotal(membersResult.data) ?? members.length,
    salesChart: salesReport.map(mapSalesDay).reverse(),
  };
}

function unwrapList<T>(value: T[] | PaginatedData<T>): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return Array.isArray(value.data) ? value.data : [];
}

function mapMemberToRow(member: MemberResource): RecentCustomerRow {
  const subscription = member.latest_subscription;
  const subscriptionStatus = subscription?.status ?? member.status ?? "unknown";
  const billingStatus = Number(member.total_paid ?? 0) > 0 ? "Paid" : "Pending";

  return {
    id: String(member.id),
    name: member.name,
    email: member.email ?? member.phone ?? "",
    plan: subscription?.plan_name ?? "No plan",
    status: toTitleCase(subscriptionStatus),
    billing: billingStatus,
    joined: member.join_date ?? member.created_at?.slice(0, 10) ?? formatDate(new Date()),
  };
}

function mapSalesDay(day: SalesReportDay): SalesChartPoint {
  return {
    date: day.date,
    revenue: Number(day.revenue),
    sales: day.sales_count,
    units: day.units_sold,
  };
}

function getMetaTotal(meta: Record<string, unknown> | undefined) {
  return typeof meta?.total === "number" ? meta.total : undefined;
}

function getPaginatedTotal<T>(value: T[] | PaginatedData<T>) {
  return !Array.isArray(value) && typeof value.total === "number" ? value.total : undefined;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTitleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
