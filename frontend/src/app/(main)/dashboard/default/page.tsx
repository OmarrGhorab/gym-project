import { Suspense } from "react";
import { subDays, format as formatDateFns } from "date-fns";

import { DashboardChartStyleSwitcher } from "./_components/dashboard-chart-style-switcher";
import { DashboardShortcuts } from "./_components/dashboard-shortcuts";
import { getDefaultDashboardData } from "./_components/data";
import { MetricCards } from "./_components/metric-cards";
import { SubscriberOverview } from "./_components/subscriber-overview";
import type { MemberBillingFilter, MemberSort, MembersQuery } from "./_components/data";

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

function parseMemberStatus(value: string | undefined) {
  return ["Active", "Expired", "Frozen", "Stopped", "Inactive", "Unknown"].includes(value ?? "") ? value : undefined;
}

function parseMemberBilling(value: string | undefined): MemberBillingFilter | undefined {
  return ["Paid", "Pending", "Overdue", "Trial"].includes(value ?? "") ? (value as MemberBillingFilter) : undefined;
}

function parseMemberSort(value: string | undefined): MemberSort {
  return value === "oldest" || value === "name-asc" || value === "name-desc" ? value : "newest";
}

function getDateParam(value: string | undefined, fallback: () => string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback();
}
