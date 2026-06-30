import { Suspense } from "react";
import { subDays, format as formatDateFns } from "date-fns";

import { DashboardChartStyleSwitcher } from "./_components/dashboard-chart-style-switcher";
import { DashboardShortcuts } from "./_components/dashboard-shortcuts";
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
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const resolvedFrom = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : defaultFrom();
  const resolvedTo = /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") ? to! : defaultTo();
  const data = await getDefaultDashboardData(resolvedFrom, resolvedTo);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <MetricCards summary={data.summary} />
      <DashboardShortcuts />
      <Suspense fallback={null}>
        <DashboardChartStyleSwitcher data={data.salesChart} summary={data.summary} />
      </Suspense>
      <SubscriberOverview members={data.members} total={data.membersTotal} />
    </div>
  );
}
