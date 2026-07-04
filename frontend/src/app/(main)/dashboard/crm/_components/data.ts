import { subDays } from "date-fns";

import { serverApiFetch } from "@/lib/api/server";

import type { MembershipPipelineRow } from "./opportunities-table/schema";
import type { MembershipChartPoint } from "./pipeline-activity";

type ApiEnvelope<T> = Awaited<ReturnType<typeof serverApiFetch<T>>>;

export type MembershipSummary = {
  activeSubscriptions: number;
  totalSubscriptions: number;
  expiringSoon: number;
  newMembersThisMonth: number;
  memberGrowthRate: number;
  subscriptionRevenue: number;
  outstandingDuesTotal: number;
  outstandingDuesCount: number;
  salesTodayRevenue: number;
};

export type RenewalFollowUp = {
  id: string;
  memberName: string;
  planName: string;
  endDate: string;
  daysLeft: number | null;
  amount: number;
};

export type MembershipDashboardData = {
  summary: MembershipSummary;
  chart: MembershipChartPoint[];
  followUps: RenewalFollowUp[];
  pipelineRows: MembershipPipelineRow[];
  renewalGoal: {
    expiringSoon: number;
    target: number;
    percentage: number;
  };
};

type DashboardSummaryResponse = {
  active_subscriptions?: number;
  revenue_mtd?: string;
  new_members_this_month?: number;
  new_members_growth_rate?: string;
  expiring_soon?: number;
  sales_today?: {
    revenue?: string;
  };
};

type SubscriptionSummaryResponse = {
  total?: number;
  active?: number;
  expired?: number;
  frozen?: number;
  stopped?: number;
  expiring_soon?: number;
  revenue?: string;
};

type SubscriptionResource = {
  id: number;
  status: string;
  billing_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  days_left?: number | null;
  price_paid?: string | number | null;
  paid_total?: string | number | null;
  balance?: string | number | null;
  renewal_health?: string | null;
  renewal_health_reason?: string | null;
  member?: {
    id?: number;
    name?: string | null;
  } | null;
  plan?: {
    id?: number;
    max_freeze_days?: number | string | null;
    name?: string | null;
  } | null;
  sold_by?: {
    id?: number;
    name?: string | null;
  } | null;
};

type DueResource = {
  subscription?: {
    id?: number;
    status?: string;
    end_date?: string | null;
  };
  member?: {
    id?: number;
    name?: string | null;
  };
  balance?: string;
  paid_total?: string;
  price_paid?: string;
};

type SalesReportDay = {
  date: string;
  revenue: string;
  sales_count: number;
  units_sold: number;
};

export async function getMembershipDashboardData(): Promise<MembershipDashboardData> {
  const to = new Date();
  const from = subDays(to, 364);
  const salesParams = new URLSearchParams({
    from: formatDate(from),
    to: formatDate(to),
    group_by: "day",
  });

  const [dashboard, subscriptionSummary, expiringSoon, dues, subscriptions, salesReport] = await Promise.all([
    safeApiFetch<DashboardSummaryResponse>("/dashboard/summary"),
    safeApiFetch<SubscriptionSummaryResponse>("/subscriptions/summary"),
    safeApiFetch<SubscriptionResource[]>("/dashboard/expiring-soon"),
    safeApiFetch<DueResource[]>("/payments/dues"),
    safeApiFetch<SubscriptionResource[]>("/subscriptions?sort=-end_date&page=1&per_page=100"),
    safeApiFetch<SalesReportDay[] | PaginatedData<SalesReportDay>>(`/sales/report?${salesParams.toString()}`),
  ]);

  const dashboardData = dashboard.data ?? {};
  const subscriptionSummaryData = subscriptionSummary.data ?? {};
  const dueRows = dues.data ?? [];
  const expiringRows = expiringSoon.data ?? [];
  const subscriptionRows = dedupeLatestSubscriptions(subscriptions.data ?? []);
  const salesRows = unwrapList(salesReport.data ?? []);
  const outstandingDuesTotal = dueRows.reduce((sum, due) => sum + Number(due.balance ?? 0), 0);
  const expiringCount = getMetaTotal(expiringSoon.meta) ?? dashboardData.expiring_soon ?? expiringRows.length;
  const activeSubscriptions = subscriptionSummaryData.active ?? dashboardData.active_subscriptions ?? 0;
  const renewalTarget = Math.max(activeSubscriptions, expiringCount, 1);

  return {
    summary: {
      activeSubscriptions,
      totalSubscriptions: subscriptionSummaryData.total ?? subscriptionRows.length,
      expiringSoon: expiringCount,
      newMembersThisMonth: dashboardData.new_members_this_month ?? 0,
      memberGrowthRate: Number(dashboardData.new_members_growth_rate ?? 0),
      subscriptionRevenue: Number(subscriptionSummaryData.revenue ?? dashboardData.revenue_mtd ?? 0),
      outstandingDuesTotal,
      outstandingDuesCount: getMetaTotal(dues.meta) ?? dueRows.length,
      salesTodayRevenue: Number(dashboardData.sales_today?.revenue ?? 0),
    },
    chart: mapSalesToMonthlyChart(salesRows),
    followUps: expiringRows.slice(0, 4).map(mapRenewalFollowUp),
    pipelineRows: subscriptionRows.map((subscription) => mapSubscriptionToPipeline(subscription, dueRows)),
    renewalGoal: {
      expiringSoon: expiringCount,
      target: renewalTarget,
      percentage: Math.min(100, Math.round((expiringCount / renewalTarget) * 100)),
    },
  };
}

type PaginatedData<T> = {
  data?: T[];
};

async function safeApiFetch<T>(path: string): Promise<Partial<ApiEnvelope<T>>> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return {};
  }
}

function unwrapList<T>(value: T[] | PaginatedData<T>): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return Array.isArray(value.data) ? value.data : [];
}

function mapSalesToMonthlyChart(rows: SalesReportDay[]): MembershipChartPoint[] {
  const monthly = new Map<string, MembershipChartPoint>();

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    const key = date.toISOString().slice(0, 7);

    monthly.set(key, {
      date: date.toISOString(),
      revenue: 0,
      sales: 0,
      units: 0,
    });
  }

  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const point = monthly.get(key);

    if (!point) {
      continue;
    }

    point.revenue += Number(row.revenue);
    point.sales += Number(row.sales_count);
    point.units += Number(row.units_sold);
  }

  return Array.from(monthly.values());
}

function mapRenewalFollowUp(subscription: SubscriptionResource): RenewalFollowUp {
  return {
    id: String(subscription.id),
    memberName: subscription.member?.name ?? "",
    planName: subscription.plan?.name ?? "",
    endDate: subscription.end_date ?? "",
    daysLeft: subscription.days_left ?? getDaysUntil(subscription.end_date),
    amount: Number(subscription.price_paid ?? 0),
  };
}

function mapSubscriptionToPipeline(subscription: SubscriptionResource, dues: DueResource[]): MembershipPipelineRow {
  const matchingDue = dues.find((due) => due.subscription?.id === subscription.id);
  const balance = Number(subscription.balance ?? matchingDue?.balance ?? 0);
  const daysLeft = subscription.days_left ?? getDaysUntil(subscription.end_date);

  return {
    id: String(subscription.id),
    subscriptionId: subscription.id,
    memberId: subscription.member?.id ?? null,
    member: subscription.member?.name ?? null,
    plan: subscription.plan?.name ?? null,
    status: subscription.status,
    billingStatus: subscription.billing_status ?? "pending",
    daysLeft,
    health: subscription.renewal_health ?? "active",
    healthReason: subscription.renewal_health_reason ?? "active_no_balance",
    paidTotal: Number(subscription.paid_total ?? 0),
    value: Number(subscription.price_paid ?? 0),
    balance,
    startDate: subscription.start_date ?? null,
    endDate: subscription.end_date ?? null,
    maxFreezeDays: Number(subscription.plan?.max_freeze_days ?? 0),
  };
}

function dedupeLatestSubscriptions(subscriptions: SubscriptionResource[]) {
  const latest = new Map<string, SubscriptionResource>();

  for (const subscription of subscriptions) {
    const memberId = subscription.member?.id ?? `memberless-${subscription.id}`;
    const planId = subscription.plan?.id ?? `planless-${subscription.id}`;
    const key = `${memberId}:${planId}`;
    const current = latest.get(key);

    if (!current || compareSubscriptionFreshness(subscription, current) > 0) {
      latest.set(key, subscription);
    }
  }

  return Array.from(latest.values()).sort((left, right) => compareSubscriptionFreshness(right, left));
}

function compareSubscriptionFreshness(left: SubscriptionResource, right: SubscriptionResource) {
  const leftEnd = Date.parse(left.end_date ?? "") || 0;
  const rightEnd = Date.parse(right.end_date ?? "") || 0;

  if (leftEnd !== rightEnd) {
    return leftEnd - rightEnd;
  }

  return left.id - right.id;
}

function getDaysUntil(date: string | null | undefined) {
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function getMetaTotal(meta: Record<string, unknown> | undefined) {
  return typeof meta?.total === "number" ? meta.total : undefined;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
