"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { LiveAttendanceData } from "./data";

export function RealtimeVisitors({ data }: { data: LiveAttendanceData }) {
  const t = useTranslations("Dashboard.analytics");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const chartConfig = {
    total: {
      color: "var(--chart-3)",
      label: t("totalInside"),
    },
  } satisfies ChartConfig;
  const recentHours = data.hourly.filter((point) => point.total > 0).slice(-12);
  const chartData = recentHours.length > 0 ? recentHours : data.hourly.slice(0, 12);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">{t("livePresence")}</CardTitle>
        <CardDescription>{t("livePresenceDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-4xl tabular-nums leading-none tracking-tight">
              {numberFormatter.format(data.currently_inside.total)}
            </div>
            <div className="text-muted-foreground text-sm">{t("peopleInside")}</div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            {t("live")}
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-34 w-full">
          <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 0 }} barCategoryGap={4}>
            <XAxis dataKey="hour" hide />
            <YAxis hide allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>

        <div className="grid grid-cols-2 overflow-hidden rounded-lg border">
          <div className="space-y-1 border-r p-4">
            <div className="text-muted-foreground text-xs">{t("members")}</div>
            <div className="text-2xl tabular-nums">{numberFormatter.format(data.currently_inside.members)}</div>
          </div>
          <div className="space-y-1 p-4">
            <div className="text-muted-foreground text-xs">{t("staff")}</div>
            <div className="text-2xl tabular-nums">{numberFormatter.format(data.currently_inside.staff)}</div>
          </div>
          <div className="space-y-1 border-t border-r p-4">
            <div className="text-muted-foreground text-xs">{t("blocked")}</div>
            <div className="text-2xl tabular-nums">{numberFormatter.format(data.today.blocked_visits)}</div>
          </div>
          <div className="space-y-1 border-t p-4">
            <div className="text-muted-foreground text-xs">{t("flagged")}</div>
            <div className="text-2xl tabular-nums">{numberFormatter.format(data.today.flagged_scans)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
