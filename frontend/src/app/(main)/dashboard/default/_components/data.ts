import { serverApiFetch } from "@/lib/api/server";

import type { StaffOption } from "../../members/_components/data";
import type { PlanRow } from "../../plans/_components/data";
import type { SalesChartPoint } from "./performance-overview";
import type { RecentCustomerRow } from "./recent-customers-table/schema";

export type DashboardSummary = {
  active_subscriptions: number;
  frozen_subscriptions?: number;
  revenue_mtd: string;
  subscription_revenue_mtd?: string;
  subscription_revenue_live?: string;
  outstanding_dues_total?: string;
  outstanding_dues_count?: number;
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
  national_id?: string | null;
  gender?: string | null;
  attendance_code?: string | null;
  attendance_qr?: string | null;
  birth_date?: string | null;
  status?: string | null;
  membership_status?: string | null;
  billing_status?: string | null;
  join_date?: string | null;
  /** When this member last bought a membership. A renewal moves it; join_date never does. */
  last_subscribed_at?: string | null;
  created_at?: string | null;
  total_paid?: string | null;
  notes?: string | null;
  has_photo?: boolean;
  updated_at?: string | null;
  latest_subscription?: {
    id?: number;
    plan_id?: number | null;
    plan_name?: string | null;
    start_date?: string | null;
    status?: string | null;
    end_date?: string | null;
    projected_end_date?: string | null;
    days_left?: number | null;
    renewal_health?: string | null;
    renewal_health_reason?: string | null;
    sessions_total?: number | null;
    sessions_remaining?: number | null;
    cancellation_grace_days?: number | null;
    discount?: string | null;
    package_paid_total?: string | null;
    package_price_paid?: string | null;
    package_balance?: string | null;
    price_paid?: string | null;
    paid_total?: string | null;
    balance?: string | null;
    freeze?: {
      id?: number;
      freeze_start?: string | null;
      freeze_end?: string | null;
      remaining_days_at_freeze?: number | null;
      projected_end_date?: string | null;
      approval_status?: string | null;
    } | null;
    pending_freeze?: {
      id: number;
      freeze_start?: string | null;
      freeze_end?: string | null;
      planned_days?: number | null;
      reason?: string | null;
      approval_status?: string | null;
    } | null;
    addons?: Array<{
      id?: number;
      status?: string | null;
      end_date?: string | null;
      price_paid?: string | null;
      paid_total?: string | null;
      plan?: {
        id?: number;
        name?: string | null;
        price?: string | number | null;
      } | null;
    }>;
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
  frozenMembers: RecentCustomerRow[];
  frozenMembersTotal: number;
  salesChart: SalesChartPoint[];
  memberDues: Record<number, RecentCustomerRow["due"]>;
  memberPlans: PlanRow[];
  memberStaff: StaffOption[];
};

export type DefaultDashboardAccess = {
  canViewEmployees: boolean;
  canViewMembers: boolean;
  canViewPayments: boolean;
  canViewPlans: boolean;
  canViewReports: boolean;
};

export type MemberSort = "newest" | "oldest" | "name-asc" | "name-desc";

export type MemberBillingFilter = "paid" | "pending" | "overdue" | "trial";

export type MemberStatusFilter = "active" | "expired" | "frozen" | "stopped" | "inactive" | "none";

export type MemberRenewalAttentionFilter = "sessions_exhausted" | "period_ended_sessions_left";

export type MembersQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: MemberStatusFilter;
  renewalAttention?: MemberRenewalAttentionFilter;
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
  access: DefaultDashboardAccess = {
    canViewEmployees: true,
    canViewMembers: true,
    canViewPayments: true,
    canViewPlans: true,
    canViewReports: true,
  },
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
    frozenMembersResult,
    salesReportResult,
    activeSubscriptionsResult,
    expiringSoonResult,
    salesTodayResult,
    topProductsResult,
    duesResult,
    plansResult,
    staffResult,
  ] = await Promise.all([
    access.canViewReports
      ? serverApiFetch<DashboardSummary>("/dashboard/summary")
      : Promise.resolve({ data: getEmptySummary() }),
    access.canViewMembers
      ? serverApiFetch<MemberResource[] | PaginatedData<MemberResource>>(`/members?${memberParams.toString()}`)
      : Promise.resolve({ data: [] }),
    access.canViewMembers
      ? serverApiFetch<MemberResource[] | PaginatedData<MemberResource>>(
          "/members?filter[freeze_queue]=1&sort=-join_date&per_page=100",
        )
      : Promise.resolve({ data: [] }),
    access.canViewReports
      ? serverApiFetch<SalesReportDay[] | PaginatedData<SalesReportDay>>(`/sales/report?${dateParams.toString()}`)
      : Promise.resolve({ data: [] }),
    safeFetch<unknown>("/dashboard/active-subscriptions", null),
    safeFetch<unknown>("/dashboard/expiring-soon?per_page=5", null),
    access.canViewReports
      ? safeFetch<{ count: number; revenue: string }>("/dashboard/sales-today", { count: 0, revenue: "0.00" })
      : Promise.resolve({ data: { count: 0, revenue: "0.00" } }),
    access.canViewReports
      ? safeFetch<unknown[]>("/dashboard/top-products?period=month&limit=5", [])
      : Promise.resolve({ data: [] }),
    access.canViewPayments
      ? safeFetch<DueResource[] | PaginatedData<DueResource>>("/payments/dues?per_page=100", [])
      : Promise.resolve({ data: [] }),
    access.canViewPlans
      ? safeFetch<PlanRow[] | PaginatedData<PlanRow>>("/plans?filter[is_active]=1&sort=name&per_page=100", [])
      : Promise.resolve({ data: [] }),
    access.canViewEmployees
      ? safeFetch<StaffOption[] | PaginatedData<StaffOption>>("/employees?filter[status]=active&per_page=100", [])
      : Promise.resolve({ data: [] }),
  ]);

  const members = unwrapList(membersResult.data);
  const frozenMembers = unwrapList(frozenMembersResult.data);
  const salesReport = unwrapList(salesReportResult.data);
  const dues = unwrapList(duesResult.data);
  const memberDues = mapMemberDues(dues);
  const memberPlans = unwrapList(plansResult.data);
  const memberStaff = unwrapList(staffResult.data);
  const membersMeta = getPaginationMeta("meta" in membersResult ? membersResult.meta : undefined, members.length);
  const frozenMembersTotal =
    getMetaTotal("meta" in frozenMembersResult ? frozenMembersResult.meta : undefined) ?? frozenMembers.length;

  // Prefer dashboard/summary MembershipMetrics totals; only fill detail payloads from extra endpoints.
  const summaryActive = summaryResult.data.active_subscriptions ?? getCount(activeSubscriptionsResult.data) ?? 0;

  return {
    summary: {
      ...summaryResult.data,
      active_subscriptions: summaryActive,
      active_subscriptions_detail: activeSubscriptionsResult.data,
      expiring_soon_detail: expiringSoonResult.data,
      sales_today_detail: salesTodayResult.data,
      top_products_detail: topProductsResult.data,
    },
    members: members.map((member) => mapMemberToRow(member, memberDues[member.id] ?? null)),
    membersTotal: membersMeta.total,
    membersMeta,
    frozenMembers: frozenMembers.map((member) => mapMemberToRow(member, memberDues[member.id] ?? null)),
    frozenMembersTotal,
    salesChart: salesReport.map(mapSalesDay).reverse(),
    memberDues,
    memberPlans,
    memberStaff,
  };
}

function getEmptySummary(): DashboardSummary {
  return {
    active_subscriptions: 0,
    revenue_mtd: "0.00",
    revenue_growth_rate: "0",
    new_members_this_month: 0,
    new_members_previous_month: 0,
    new_members_growth_rate: "0",
    expiring_soon: 0,
    sales_today: {
      count: 0,
      revenue: "0.00",
    },
    top_products: [],
    captain_leaderboard: [],
  };
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}

function getCount(value: unknown) {
  if (value && typeof value === "object" && "count" in value) {
    const count = Number(value.count);

    return Number.isFinite(count) ? count : undefined;
  }

  return undefined;
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

  if (options.renewalAttention) {
    params.set("filter[renewal_attention]", options.renewalAttention);
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
    // Ordered on the member's newest subscription, not on join_date. A renewal
    // writes a fresh subscription and never touches join_date, so sorting on the
    // latter buried a member of two years who renewed this morning. Members who
    // have never subscribed sort last.
    case "oldest":
      return "last_subscription";
    case "name-asc":
      return "name";
    case "name-desc":
      return "-name";
    default:
      return "-last_subscription";
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
    national_id: member.national_id ?? null,
    gender: member.gender ?? null,
    attendance_code: member.attendance_code ?? null,
    attendance_qr: member.attendance_qr ?? null,
    birth_date: member.birth_date ?? null,
    plan: subscription?.plan_name ?? null,
    planStartsAt: subscription?.start_date ?? null,
    planEndsAt: subscription?.projected_end_date ?? subscription?.end_date ?? null,
    status: member.status === "inactive" ? "inactive" : (member.membership_status ?? member.status ?? null),
    billing: member.billing_status ?? "unknown",
    totalPaid: subscription?.package_paid_total ?? member.total_paid ?? "0.00",
    joined: member.join_date ?? member.created_at?.slice(0, 10) ?? null,
    lastSubscribedAt: member.last_subscribed_at ?? null,
    notes: member.notes ?? null,
    has_photo: member.has_photo ?? false,
    updated_at: member.updated_at ?? null,
    latest_subscription: subscription?.id
      ? {
          id: subscription.id,
          plan_id: subscription.plan_id ?? null,
          plan_name: subscription.plan_name ?? null,
          start_date: subscription.start_date ?? null,
          end_date: subscription.end_date ?? null,
          projected_end_date: subscription.projected_end_date ?? null,
          status: subscription.status ?? "unknown",
          days_left: subscription.days_left ?? null,
          renewal_health: subscription.renewal_health ?? null,
          renewal_health_reason: subscription.renewal_health_reason ?? null,
          sessions_total: subscription.sessions_total ?? null,
          sessions_remaining: subscription.sessions_remaining ?? null,
          cancellation_grace_days: subscription.cancellation_grace_days ?? null,
          discount: subscription.discount ?? null,
          package_paid_total: subscription.package_paid_total ?? null,
          package_price_paid: subscription.package_price_paid ?? null,
          package_balance: subscription.package_balance ?? null,
          price_paid: subscription.price_paid ?? null,
          paid_total: subscription.paid_total ?? null,
          balance: subscription.balance ?? null,
          freeze: subscription.freeze ?? null,
          pending_freeze: subscription.pending_freeze ?? null,
          addons: subscription.addons?.flatMap((addon) => {
            if (!addon.id) {
              return [];
            }

            return [
              {
                id: addon.id,
                status: addon.status ?? undefined,
                end_date: addon.end_date ?? null,
                price_paid: addon.price_paid ?? undefined,
                paid_total: addon.paid_total ?? undefined,
                plan: addon.plan?.id
                  ? {
                      id: addon.plan.id,
                      name: addon.plan.name ?? null,
                    }
                  : undefined,
              },
            ];
          }),
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
