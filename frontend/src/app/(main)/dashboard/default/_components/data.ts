import { serverApiFetch } from "@/lib/api/server";

import type { StaffOption } from "../../members/_components/data";
import type { PlanRow } from "../../plans/_components/data";
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
  active_subscriptions_detail?: unknown;
  expiring_soon_detail?: unknown;
  sales_today_detail?: unknown;
  top_products_detail?: unknown[];
};

type MemberResource = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  attendance_code?: string | null;
  attendance_qr?: string | null;
  birth_date?: string | null;
  status?: string | null;
  membership_status?: string | null;
  billing_status?: string | null;
  join_date?: string | null;
  created_at?: string | null;
  total_paid?: string | null;
  notes?: string | null;
  has_photo?: boolean;
  updated_at?: string | null;
  latest_subscription?: {
    id?: number;
    plan_name?: string | null;
    start_date?: string | null;
    status?: string | null;
    end_date?: string | null;
    package_paid_total?: string | null;
    package_price_paid?: string | null;
    package_balance?: string | null;
  } | null;
};

type DueResource = {
  subscription_id: number;
  member_id?: number | null;
  member_name?: string | null;
  subscription_status?: string | null;
  end_date?: string | null;
  balance?: string | null;
  paid_total?: string | null;
  price_paid?: string | null;
};

type PaginatedData<T> = {
  data?: T[];
  total?: number;
};

type SalesReportDay = {
  date: string;
  membership_subscriptions?: number;
  revenue: string;
  sales_count: number;
  units_sold: number;
};

export type DefaultDashboardData = {
  summary: DashboardSummary;
  members: RecentCustomerRow[];
  membersTotal: number;
  membersMeta: MembersMeta;
  salesChart: SalesChartPoint[];
  memberDues: Record<number, RecentCustomerRow["due"]>;
  memberPlans: PlanRow[];
  memberStaff: StaffOption[];
};

export type MemberSort = "newest" | "oldest" | "name-asc" | "name-desc";

export type MemberBillingFilter = "paid" | "pending" | "overdue" | "trial";

export type MemberStatusFilter = "active" | "expired" | "frozen" | "stopped" | "inactive" | "none";

export type MembersQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: MemberStatusFilter;
  billing?: MemberBillingFilter;
  joinedWindow?: "30" | "90";
  sort?: MemberSort;
};

export type MembersMeta = {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export async function getDefaultDashboardData(
  from: string,
  to: string,
  membersQuery: MembersQuery = {},
): Promise<DefaultDashboardData> {
  const dateParams = new URLSearchParams({
    from,
    to,
    group_by: "day",
  });
  const memberParams = buildMemberParams(membersQuery);

  const [
    summaryResult,
    membersResult,
    salesReportResult,
    activeSubscriptionsResult,
    expiringSoonResult,
    salesTodayResult,
    topProductsResult,
    duesResult,
    plansResult,
    staffResult,
  ] = await Promise.all([
    serverApiFetch<DashboardSummary>("/dashboard/summary"),
    serverApiFetch<MemberResource[] | PaginatedData<MemberResource>>(`/members?${memberParams.toString()}`),
    serverApiFetch<SalesReportDay[] | PaginatedData<SalesReportDay>>(`/sales/report?${dateParams.toString()}`),
    safeFetch<unknown>("/dashboard/active-subscriptions", null),
    safeFetch<unknown>("/dashboard/expiring-soon?per_page=5", null),
    safeFetch<{ count: number; revenue: string }>("/dashboard/sales-today", { count: 0, revenue: "0.00" }),
    safeFetch<unknown[]>("/dashboard/top-products?period=month&limit=5", []),
    safeFetch<DueResource[] | PaginatedData<DueResource>>("/payments/dues?per_page=100", []),
    safeFetch<PlanRow[] | PaginatedData<PlanRow>>("/plans?filter[is_active]=1&sort=name&per_page=100", []),
    safeFetch<StaffOption[] | PaginatedData<StaffOption>>("/employees?filter[status]=active&per_page=100", []),
  ]);

  const members = unwrapList(membersResult.data);
  const salesReport = unwrapList(salesReportResult.data);
  const dues = unwrapList(duesResult.data);
  const memberDues = mapMemberDues(dues);
  const memberPlans = unwrapList(plansResult.data);
  const memberStaff = unwrapList(staffResult.data);
  const membersMeta = getPaginationMeta(membersResult.meta, members.length);

  return {
    summary: {
      ...summaryResult.data,
      active_subscriptions_detail: activeSubscriptionsResult.data,
      expiring_soon_detail: expiringSoonResult.data,
      sales_today_detail: salesTodayResult.data,
      top_products_detail: topProductsResult.data,
    },
    members: members.map((member) => mapMemberToRow(member, memberDues[member.id] ?? null)),
    membersTotal: membersMeta.total,
    membersMeta,
    salesChart: salesReport.map(mapSalesDay).reverse(),
    memberDues,
    memberPlans,
    memberStaff,
  };
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}

function buildMemberParams(options: MembersQuery) {
  const params = new URLSearchParams();
  params.set("page", String(options.page ?? 1));
  params.set("per_page", String(options.perPage ?? 10));
  params.set("sort", getMemberSortParam(options.sort ?? "newest"));

  if (options.search) {
    params.set("filter[search]", options.search);
  }

  if (options.status) {
    params.set("filter[subscription_status]", options.status);
  }

  if (options.billing) {
    params.set("filter[billing]", options.billing);
  }

  const joinedFrom = getJoinedFromDate(options.joinedWindow);

  if (joinedFrom) {
    params.set("filter[joined_from]", joinedFrom);
    params.set("filter[joined_to]", formatDate(new Date()));
  }

  return params;
}

function getMemberSortParam(sort: MemberSort) {
  switch (sort) {
    case "oldest":
      return "join_date";
    case "name-asc":
      return "name";
    case "name-desc":
      return "-name";
    default:
      return "-join_date";
  }
}

function getJoinedFromDate(window: MembersQuery["joinedWindow"]) {
  if (!window) {
    return undefined;
  }

  const days = Number(window);

  if (!Number.isFinite(days)) {
    return undefined;
  }

  const date = new Date();
  date.setDate(date.getDate() - days);

  return formatDate(date);
}

function unwrapList<T>(value: T[] | PaginatedData<T>): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return Array.isArray(value.data) ? value.data : [];
}

function mapMemberToRow(member: MemberResource, due: RecentCustomerRow["due"]): RecentCustomerRow {
  const subscription = member.latest_subscription;

  return {
    id: String(member.id),
    name: member.name,
    email: member.email ?? "",
    phone: member.phone ?? "",
    gender: member.gender ?? null,
    attendance_code: member.attendance_code ?? null,
    attendance_qr: member.attendance_qr ?? null,
    birth_date: member.birth_date ?? null,
    plan: subscription?.plan_name ?? null,
    planEndsAt: subscription?.end_date ?? null,
    status: member.membership_status ?? null,
    billing: member.billing_status ?? "unknown",
    totalPaid: subscription?.package_paid_total ?? member.total_paid ?? "0.00",
    joined: member.join_date ?? member.created_at?.slice(0, 10) ?? null,
    notes: member.notes ?? null,
    has_photo: member.has_photo ?? false,
    updated_at: member.updated_at ?? null,
    latest_subscription: subscription?.id
      ? {
          id: subscription.id,
          plan_name: subscription.plan_name ?? null,
          start_date: subscription.start_date ?? null,
          end_date: subscription.end_date ?? null,
          status: subscription.status ?? "unknown",
          package_paid_total: subscription.package_paid_total ?? null,
          package_price_paid: subscription.package_price_paid ?? null,
          package_balance: subscription.package_balance ?? null,
        }
      : null,
    due,
  };
}

function mapSalesDay(day: SalesReportDay): SalesChartPoint {
  return {
    date: day.date,
    memberships: Number(day.membership_subscriptions ?? 0),
    revenue: Number(day.revenue),
    sales: day.sales_count,
    units: day.units_sold,
  };
}

function getMetaTotal(meta: Record<string, unknown> | undefined) {
  return typeof meta?.total === "number" ? meta.total : undefined;
}
function getPaginationMeta(meta: Record<string, unknown> | undefined, fallbackTotal: number): MembersMeta {
  const total = getMetaTotal(meta) ?? fallbackTotal;
  const perPage = getMetaNumber(meta, "per_page", fallbackTotal || 10);

  return {
    currentPage: getMetaNumber(meta, "current_page", 1),
    perPage,
    total,
    lastPage: getMetaNumber(meta, "last_page", Math.max(1, Math.ceil(total / perPage))),
  };
}

function getMetaNumber(meta: Record<string, unknown> | undefined, key: string, fallback: number) {
  const value = Number(meta?.[key]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mapMemberDues(dues: DueResource[]) {
  const result: Record<number, RecentCustomerRow["due"]> = {};

  for (const due of dues) {
    if (typeof due.member_id !== "number" || due.member_id <= 0) {
      continue;
    }

    result[due.member_id] = {
      subscription_id: due.subscription_id,
      member_id: due.member_id,
      member_name: due.member_name ?? null,
      subscription_status: due.subscription_status ?? "unknown",
      end_date: due.end_date ?? null,
      balance: due.balance ?? "0",
      paid_total: due.paid_total ?? "0",
      price_paid: due.price_paid ?? "0",
    };
  }

  return result;
}
