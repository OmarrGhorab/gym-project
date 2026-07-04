"use client";

import { MoreHorizontal } from "lucide-react";
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
    value: {
      color: "var(--foreground)",
      label: t("selectedMetric"),
    },
  } satisfies ChartConfig;
  const latestActiveIndex = data.hourly.findLastIndex((point) => point.total > 0);
  const chartData =
    latestActiveIndex >= 0
      ? data.hourly.slice(Math.max(0, latestActiveIndex - 11), latestActiveIndex + 1)
      : data.hourly.slice(0, 12);

  return (
    <Card className="h-full overflow-hidden bg-foreground text-background dark:bg-card dark:text-card-foreground">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-normal">{t("livePresence")}</CardTitle>
          <CardDescription className="text-background/55 dark:text-muted-foreground">
            {t("livePresenceDescription")}
          </CardDescription>
        </div>
        <MoreHorizontal className="size-5 text-background/65 dark:text-muted-foreground" />
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-3xl tabular-nums leading-none tracking-tight">
              {numberFormatter.format(data.currently_inside.total)}
              <span className="ml-1 text-background/65 text-base dark:text-muted-foreground">
                {t("peoplePerMinute")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-background/70 text-sm dark:text-muted-foreground">
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
            <Bar dataKey="value" fill="var(--color-value)" opacity={0.75} radius={3} />
          </BarChart>
        </ChartContainer>

        <div className="grid grid-cols-2 overflow-hidden border-background/10 border-t text-sm dark:border-border">
          <div className="flex items-center justify-between gap-3 border-background/10 border-r py-3 pr-4 dark:border-border">
            <span className="font-medium">{t("members")}</span>
            <span className="tabular-nums">{numberFormatter.format(data.currently_inside.members)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-3 pl-4">
            <span className="font-medium">{t("staff")}</span>
            <span className="tabular-nums">{numberFormatter.format(data.currently_inside.staff)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-background/10 border-t border-r py-3 pr-4 dark:border-border">
            <span className="font-medium">{t("blocked")}</span>
            <span className="tabular-nums">{numberFormatter.format(data.today.blocked_visits)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-background/10 border-t py-3 pl-4 dark:border-border">
            <span className="font-medium">{t("flagged")}</span>
            <span className="tabular-nums">{numberFormatter.format(data.today.flagged_scans)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
