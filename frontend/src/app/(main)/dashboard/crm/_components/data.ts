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
  reminderDays: number[];
};

type SettingsResponse = {
  reminder_days?: number[];
};

type DashboardSummaryResponse = {
  active_subscriptions?: number;
  frozen_subscriptions?: number;
  revenue_mtd?: string;
  subscription_revenue_mtd?: string;
  subscription_revenue_live?: string;
  outstanding_dues_total?: string;
  outstanding_dues_count?: number;
  new_members_this_month?: number;
  new_members_growth_rate?: string;
  expiring_soon?: number;
  sales_today?: {
    count?: number;
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
  revenue_mtd?: string;
  outstanding_dues_total?: string;
  outstanding_dues_count?: number;
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
  collected_paid_total?: string | number | null;
  refund_total?: string | number | null;
  balance?: string | number | null;
  package_price_paid?: string | number | null;
  package_paid_total?: string | number | null;
  package_balance?: string | number | null;
  can_cancel_with_refund?: boolean | null;
  default_refund_amount?: string | number | null;
  cancellation_grace_ends_on?: string | null;
  renewal_health?: string | null;
  renewal_health_reason?: string | null;
  refunds?: Array<{
    id: number;
    amount?: string | number | null;
    method?: string | null;
    reason?: string | null;
    refunded_at?: string | null;
  }> | null;
  member?: {
    id?: number;
    name?: string | null;
    phone?: string | null;
    attendance_qr?: string | null;
  } | null;
  plan?: {
    id?: number;
    duration_days?: number | string | null;
    duration_months?: number | string | null;
    max_freeze_days?: number | string | null;
    min_freeze_days?: number | string | null;
    access_grace_days?: number | string | null;
    name?: string | null;
  } | null;
  freeze?: {
    freeze_start?: string | null;
    freeze_end?: string | null;
    resumed_on?: string | null;
    planned_days?: number | string | null;
    remaining_days_at_freeze?: number | string | null;
    reason?: string | null;
  } | null;
  addons?: {
    id: number;
    end_date?: string | null;
    price_paid?: string | number | null;
    sessions_total?: number | null;
    sessions_remaining?: number | null;
    plan?: {
      name?: string | null;
    } | null;
    coach?: {
      name?: string | null;
    } | null;
  }[];
  sold_by?: {
    id?: number;
    name?: string | null;
  } | null;
};

type PlanResource = {
  id: number;
  name?: string | null;
  price?: string | number | null;
  duration_days?: string | number | null;
  duration_months?: string | number | null;
  category?: string | null;
  type?: string | null;
};

type CoachOptionResource = {
  id: number;
  name?: string | null;
  role?: string | null;
  status?: string | null;
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
  base_price_paid?: string;
  base_paid_total?: string;
  addon_price_total?: string;
  addon_paid_total?: string;
};

type SalesReportDay = {
  period?: string;
  date?: string;
  revenue: string;
  sales_count?: number;
  units_sold?: number;
};

export async function getMembershipDashboardData(): Promise<MembershipDashboardData> {
  const to = new Date();
  const from = subDays(to, 364);
  const salesParams = new URLSearchParams({
    from: formatDate(from),
    to: formatDate(to),
    group_by: "month",
    revenue_source: "subscriptions",
  });

  const [dashboard, subscriptionSummary, expiringSoon, dues, subscriptions, salesReport, plans, coaches, settings] =
    await Promise.all([
      safeApiFetch<DashboardSummaryResponse>("/dashboard/summary"),
      safeApiFetch<SubscriptionSummaryResponse>("/subscriptions/summary"),
      safeApiFetch<SubscriptionResource[]>("/dashboard/expiring-soon"),
      safeApiFetch<DueResource[] | PaginatedData<DueResource>>("/payments/dues?per_page=100"),
      safeApiFetch<SubscriptionResource[]>("/subscriptions?sort=-end_date&page=1&per_page=100"),
      safeApiFetch<SalesReportDay[] | PaginatedData<SalesReportDay>>(`/reports/financial?${salesParams.toString()}`),
      safeApiFetch<PlanResource[] | PaginatedData<PlanResource>>("/plans?filter[is_active]=1&sort=name&per_page=100"),
      safeApiFetch<CoachOptionResource[] | PaginatedData<CoachOptionResource>>(
        "/employees?filter[status]=active&per_page=100&sort=name",
      ),
      safeApiFetch<SettingsResponse>("/settings"),
    ]);

  const dashboardData = dashboard.data ?? {};
  const subscriptionSummaryData = subscriptionSummary.data ?? {};
  const dueRows = unwrapList(dues.data ?? []);
  const duesMeta = "meta" in dues && dues.meta ? dues.meta : {};
  const expiringRows = Array.isArray(expiringSoon.data) ? expiringSoon.data : unwrapList(expiringSoon.data ?? []);
  const subscriptionRows = dedupeLatestSubscriptions(
    Array.isArray(subscriptions.data) ? subscriptions.data : unwrapList(subscriptions.data ?? []),
  );
  const latestDueRows = filterDuesForSubscriptions(dueRows, subscriptionRows);
  const latestExpiringRows = filterLatestExpiringRows(subscriptionRows, expiringRows);
  const salesRows = unwrapList(salesReport.data ?? []);
  const planRows = unwrapList(plans.data ?? []);
  const coachRows = unwrapList(coaches.data ?? []).filter(
    (coach) => coach.role === "coach" || coach.role === "captain",
  );
  const reminderDays = normalizeReminderDays(settings.data?.reminder_days);

  // Authoritative totals from backend (MembershipMetrics) — never re-sum partial table pages.
  const activeSubscriptions = dashboardData.active_subscriptions ?? subscriptionSummaryData.active ?? 0;
  const expiringCount = dashboardData.expiring_soon ?? subscriptionSummaryData.expiring_soon ?? 0;
  const outstandingDuesTotal = Number(
    dashboardData.outstanding_dues_total ??
      subscriptionSummaryData.outstanding_dues_total ??
      (typeof duesMeta.outstanding_dues_total === "string" || typeof duesMeta.outstanding_dues_total === "number"
        ? duesMeta.outstanding_dues_total
        : latestDueRows.reduce((sum, due) => sum + Number(due.balance ?? 0), 0)),
  );
  const outstandingDuesCount = Number(
    dashboardData.outstanding_dues_count ??
      subscriptionSummaryData.outstanding_dues_count ??
      (typeof duesMeta.outstanding_dues_count === "number" ? duesMeta.outstanding_dues_count : latestDueRows.length),
  );
  const subscriptionRevenue = Number(dashboardData.subscription_revenue_live ?? subscriptionSummaryData.revenue ?? 0);
  const renewalTarget = Math.max(activeSubscriptions, expiringCount, 1);

  return {
    summary: {
      activeSubscriptions,
      totalSubscriptions: subscriptionSummaryData.total ?? subscriptionRows.length,
      expiringSoon: expiringCount,
      newMembersThisMonth: dashboardData.new_members_this_month ?? 0,
      memberGrowthRate: Number(dashboardData.new_members_growth_rate ?? 0),
      subscriptionRevenue,
      outstandingDuesTotal,
      outstandingDuesCount,
      salesTodayRevenue: Number(dashboardData.sales_today?.revenue ?? 0),
    },
    chart: mapSalesToMonthlyChart(salesRows),
    followUps: latestExpiringRows.slice(0, 4).map(mapRenewalFollowUp),
    pipelineRows: subscriptionRows.map((subscription) =>
      mapSubscriptionToPipeline(subscription, latestDueRows, planRows, coachRows, reminderDays),
    ),
    renewalGoal: {
      expiringSoon: expiringCount,
      target: renewalTarget,
      percentage: Math.min(100, Math.round((expiringCount / renewalTarget) * 100)),
    },
    reminderDays,
  };
}

function normalizeReminderDays(value: number[] | undefined) {
  const days = (value ?? [7]).map((day) => Number(day)).filter((day) => Number.isFinite(day) && day >= 0);

  return Array.from(new Set(days)).sort((left, right) => right - left);
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
    const key = (row.period ?? row.date ?? "").slice(0, 7);
    const point = monthly.get(key);

    if (!point) {
      continue;
    }

    point.revenue += Number(row.revenue);
    point.sales += Number(row.sales_count ?? 0);
    point.units += Number(row.units_sold ?? 0);
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
    amount: Number(subscription.package_price_paid ?? subscription.price_paid ?? 0),
  };
}

function filterLatestExpiringRows(
  latestSubscriptions: SubscriptionResource[],
  expiringSubscriptions: SubscriptionResource[],
): SubscriptionResource[] {
  const expiringIds = new Set(expiringSubscriptions.map((subscription) => subscription.id));

  return latestSubscriptions
    .filter((subscription) => expiringIds.has(subscription.id))
    .sort(
      (left, right) =>
        (left.days_left ?? getDaysUntil(left.end_date) ?? 0) - (right.days_left ?? getDaysUntil(right.end_date) ?? 0),
    );
}

function filterDuesForSubscriptions(dues: DueResource[], subscriptions: SubscriptionResource[]): DueResource[] {
  const subscriptionIds = new Set(subscriptions.map((subscription) => subscription.id));

  return dues.filter((due) => {
    const subscriptionId = due.subscription?.id;

    return typeof subscriptionId === "number" && subscriptionIds.has(subscriptionId);
  });
}

function mapSubscriptionToPipeline(
  subscription: SubscriptionResource,
  dues: DueResource[],
  plans: PlanResource[],
  coaches: CoachOptionResource[],
  reminderDays: number[],
): MembershipPipelineRow {
  const matchingDue = dues.find((due) => due.subscription?.id === subscription.id);
  const balance = Number(subscription.package_balance ?? matchingDue?.balance ?? subscription.balance ?? 0);
  // Closed subs must not show leftover calendar days from the original end_date.
  const isClosed = subscription.status === "stopped" || subscription.status === "expired";
  const daysLeft = isClosed ? null : (subscription.days_left ?? getDaysUntil(subscription.end_date));
  const rawPaidTotal = Number(
    subscription.package_paid_total ?? matchingDue?.paid_total ?? subscription.paid_total ?? 0,
  );
  const matchingPlan = plans.find((plan) => plan.id === subscription.plan?.id);
  const addonsTotal = (subscription.addons ?? []).reduce((sum, a) => sum + Number(a.price_paid ?? 0), 0);
  const baseValue = Number(matchingPlan?.price ?? subscription.price_paid ?? 0);
  const packageValue = Number(
    subscription.package_price_paid ??
      (baseValue > 0 || addonsTotal > 0
        ? baseValue + addonsTotal
        : (matchingDue?.price_paid ?? subscription.price_paid ?? 0)),
  );
  const paidTotal = rawPaidTotal > 0 ? rawPaidTotal : packageValue;
  const collectedPaidTotal = Number(
    subscription.collected_paid_total ?? subscription.package_paid_total ?? subscription.paid_total ?? paidTotal,
  );
  const refundTotal = Number(subscription.refund_total ?? 0);

  return {
    id: String(subscription.id),
    subscriptionId: subscription.id,
    memberId: subscription.member?.id ?? null,
    member: subscription.member?.name ?? null,
    memberPhone: subscription.member?.phone ?? null,
    memberQr: subscription.member?.attendance_qr ?? null,
    planId: subscription.plan?.id ?? null,
    plan: subscription.plan?.name ?? null,
    addons: (subscription.addons ?? []).map((addon) => ({
      id: addon.id,
      name: addon.plan?.name ?? "",
      coach: addon.coach?.name ?? null,
      price: Number(addon.price_paid ?? 0),
      endDate: addon.end_date ?? null,
      sessionsTotal: addon.sessions_total ?? null,
      sessionsRemaining: addon.sessions_remaining ?? null,
    })),
    planOptions: plans.map((plan) => {
      const category = plan.category ?? "gym_access";

      return {
        id: plan.id,
        name: plan.name ?? "",
        price: Number(plan.price ?? 0),
        durationDays: Number(plan.duration_days ?? 0),
        durationMonths:
          plan.duration_months === null || plan.duration_months === undefined ? null : Number(plan.duration_months),
        category,
        kind: category === "gym_access" ? ("main" as const) : ("extra" as const),
      };
    }),
    coachOptions: coaches.map((coach) => ({
      id: coach.id,
      name: coach.name ?? `Coach #${coach.id}`,
      role: coach.role ?? "coach",
    })),
    status: subscription.status,
    billingStatus: subscription.billing_status ?? "pending",
    daysLeft,
    health: subscription.renewal_health ?? "active",
    healthReason: subscription.renewal_health_reason ?? "active_no_balance",
    paidTotal,
    collectedPaidTotal,
    refundTotal,
    value: packageValue,
    balance,
    startDate: subscription.start_date ?? null,
    endDate: subscription.end_date ?? null,
    canCancelWithRefund: Boolean(subscription.can_cancel_with_refund),
    defaultRefundAmount: Number(
      subscription.default_refund_amount ?? subscription.collected_paid_total ?? subscription.paid_total ?? 0,
    ),
    cancellationGraceEndsOn: subscription.cancellation_grace_ends_on ?? null,
    reminderDays,
    maxFreezeDays: Number(subscription.plan?.max_freeze_days ?? 0),
    minFreezeDays: Number(subscription.plan?.min_freeze_days ?? 0),
    freeze: subscription.freeze
      ? {
          freezeStart: subscription.freeze.freeze_start ?? null,
          freezeEnd: subscription.freeze.freeze_end ?? null,
          resumedOn: subscription.freeze.resumed_on ?? null,
          plannedDays:
            subscription.freeze.planned_days === null || subscription.freeze.planned_days === undefined
              ? null
              : Number(subscription.freeze.planned_days),
          remainingDaysAtFreeze:
            subscription.freeze.remaining_days_at_freeze === null ||
            subscription.freeze.remaining_days_at_freeze === undefined
              ? null
              : Number(subscription.freeze.remaining_days_at_freeze),
          reason: subscription.freeze.reason ?? null,
        }
      : null,
  };
}

function dedupeLatestSubscriptions(subscriptions: SubscriptionResource[]) {
  const latest = new Map<string, SubscriptionResource>();

  for (const subscription of subscriptions) {
    const memberId = subscription.member?.id ?? `memberless-${subscription.id}`;
    const key = `${memberId}`;
    const current = latest.get(key);

    if (!current || compareSubscriptionFreshness(subscription, current) > 0) {
      latest.set(key, subscription);
    }
  }

  return Array.from(latest.values()).sort((left, right) => compareSubscriptionFreshness(right, left));
}

function compareSubscriptionFreshness(left: SubscriptionResource, right: SubscriptionResource) {
  const leftStatusPriority = getSubscriptionStatusPriority(left.status);
  const rightStatusPriority = getSubscriptionStatusPriority(right.status);

  if (leftStatusPriority !== rightStatusPriority) {
    return leftStatusPriority - rightStatusPriority;
  }

  const leftEnd = Date.parse(left.end_date ?? "") || 0;
  const rightEnd = Date.parse(right.end_date ?? "") || 0;

  if (leftEnd !== rightEnd) {
    return leftEnd - rightEnd;
  }

  return left.id - right.id;
}

function getSubscriptionStatusPriority(status: string) {
  switch (status) {
    case "active":
      return 5;
    case "frozen":
      return 4;
    case "pending":
      return 3;
    case "expired":
      return 2;
    case "stopped":
      return 1;
    default:
      return 0;
  }
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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
