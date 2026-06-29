import { DashboardChartStyleSwitcher } from "./_components/dashboard-chart-style-switcher";
import { getDefaultDashboardData } from "./_components/data";
import { MetricCards } from "./_components/metric-cards";
import { SubscriberOverview } from "./_components/subscriber-overview";

export default async function Page() {
  const data = await getDefaultDashboardData();

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <MetricCards summary={data.summary} />
      <DashboardChartStyleSwitcher data={data.salesChart} summary={data.summary} />
      <SubscriberOverview members={data.members} total={data.membersTotal} />
    </div>
  );
}
