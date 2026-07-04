import { Suspense } from "react";

import { redirect } from "next/navigation";

import { format as formatDateFns, subDays } from "date-fns";

import { canAccessRoute, firstAccessibleDashboardPath } from "@/lib/authorization";
import { getCurrentUser, requireAuth } from "@/lib/session";

import { DashboardChartStyleSwitcher } from "./_components/dashboard-chart-style-switcher";
import { DashboardShortcuts } from "./_components/dashboard-shortcuts";
import type { MemberBillingFilter, MemberSort, MemberStatusFilter, MembersQuery } from "./_components/data";
import { getDefaultDashboardData } from "./_components/data";
import { MetricCards } from "./_components/metric-cards";
import { SubscriberOverview } from "./_components/subscriber-overview";

function defaultFrom() {
  return formatDateFns(subDays(new Date(), 364), "yyyy-MM-dd");
}

function defaultTo() {
  return formatDateFns(new Date(), "yyyy-MM-dd");
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    members_page?: string;
    members_per_page?: string;
    members_search?: string;
    members_status?: string;
    members_billing?: string;
    members_joined?: string;
    members_sort?: string;
  }>;
}) {
  await requireAuth();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/v2/login");
  }

  if (!canAccessRoute(user, "/dashboard/default")) {
    redirect(
      firstAccessibleDashboardPath(user) === "/dashboard/[...not-found]"
        ? "/unauthorized"
        : firstAccessibleDashboardPath(user),
    );
  }

  const { from, to, ...memberParams } = await searchParams;
  const resolvedFrom = getDateParam(from, defaultFrom);
  const resolvedTo = getDateParam(to, defaultTo);
  const membersQuery = parseMembersQuery(memberParams);
  const data = await getDefaultDashboardData(resolvedFrom, resolvedTo, membersQuery);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <MetricCards summary={data.summary} />
      <DashboardShortcuts />
      <Suspense fallback={null}>
        <DashboardChartStyleSwitcher data={data.salesChart} summary={data.summary} />
      </Suspense>
      <SubscriberOverview
        members={data.members}
        total={data.membersTotal}
        meta={data.membersMeta}
        query={membersQuery}
      />
    </div>
  );
}

function parseMembersQuery(params: {
  members_page?: string;
  members_per_page?: string;
  members_search?: string;
  members_status?: string;
  members_billing?: string;
  members_joined?: string;
  members_sort?: string;
}): MembersQuery {
  return {
    page: parsePositiveInt(params.members_page, 1),
    perPage: parsePageSize(params.members_per_page),
    search: params.members_search ? params.members_search : undefined,
    status: parseMemberStatus(params.members_status),
    billing: parseMemberBilling(params.members_billing),
    joinedWindow: params.members_joined === "30" || params.members_joined === "90" ? params.members_joined : undefined,
    sort: parseMemberSort(params.members_sort),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | undefined) {
  const parsed = parsePositiveInt(value, 10);

  return [10, 20, 30, 40, 50].includes(parsed) ? parsed : 10;
}

function parseMemberStatus(value: string | undefined): MemberStatusFilter | undefined {
  const statuses: MemberStatusFilter[] = ["active", "expired", "frozen", "stopped", "inactive", "none"];

  return statuses.find((status) => status === value);
}

function parseMemberBilling(value: string | undefined): MemberBillingFilter | undefined {
  const statuses: MemberBillingFilter[] = ["paid", "pending", "overdue", "trial"];

  return statuses.find((status) => status === value);
}

function parseMemberSort(value: string | undefined): MemberSort {
  return value === "oldest" || value === "name-asc" || value === "name-desc" ? value : "newest";
}

function getDateParam(value: string | undefined, fallback: () => string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback();
}
