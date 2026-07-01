import { getTranslations } from "next-intl/server";

import { AnalyticsKpiStrip } from "./_components/analytics-kpi-strip";
import { AnalyticsToolbar } from "./_components/analytics-toolbar";
import { getLiveAttendanceData } from "./_components/data";
import { RealtimeVisitors } from "./_components/realtime-visitors";
import { TopPages } from "./_components/top-pages";
import { TopTrafficSources } from "./_components/top-traffic-sources";
import { TrafficQuality } from "./_components/traffic-quality";

type PageProps = {
  searchParams: Promise<{
    audience?: string;
    date?: string;
    hours?: string;
    metric?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const filters = await searchParams;
  const t = await getTranslations("Dashboard.analytics");
  const data = await getLiveAttendanceData(filters);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>

        <AnalyticsToolbar filters={data.filters} generatedAt={data.generated_at} />
      </div>

      <AnalyticsKpiStrip data={data} />

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <TrafficQuality data={data.hourly} />
        </div>
        <div className="xl:col-span-4">
          <RealtimeVisitors data={data} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <TopPages rows={data.currently_inside_rows} />
        </div>
        <div className="xl:col-span-5">
          <TopTrafficSources alerts={data.alerts} methods={data.scan_methods} />
        </div>
      </div>

      {data.currently_inside.total === 0 && data.today.member_visits === 0 && data.today.staff_checkins === 0 ? (
        <p className="text-muted-foreground text-sm">{t("emptyToday")}</p>
      ) : null}
    </div>
  );
}
