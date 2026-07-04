"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { LiveAttendanceHourlyPoint } from "./data";

export function TrafficQuality({ data }: { data: LiveAttendanceHourlyPoint[] }) {
  const t = useTranslations("Dashboard.analytics");
  const chartConfig = {
    members: {
      color: "var(--chart-3)",
      label: t("members"),
    },
    staff: {
      color: "var(--chart-1)",
      label: t("staff"),
    },
    total: {
      color: "var(--foreground)",
      label: t("totalInside"),
    },
    value: {
      color: "var(--foreground)",
      label: t("selectedMetric"),
    },
    comparison: {
      color: "var(--muted-foreground)",
      label: t("previousDay"),
    },
  } satisfies ChartConfig;

  return (
    <Card className="h-full overflow-hidden bg-foreground text-background dark:bg-card dark:text-card-foreground">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-normal">{t("trafficQuality")}</CardTitle>
          <CardDescription className="text-background/55 dark:text-muted-foreground">
            {t("hourlyOccupancyDescription")}
          </CardDescription>
        </div>
        <MoreHorizontal className="size-5 text-background/65 dark:text-muted-foreground" />
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-80 w-full">
          <LineChart data={data} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.1} />
            <XAxis
              dataKey="hour"
              axisLine={false}
              interval="preserveStartEnd"
              tickLine={false}
              tickMargin={12}
              tick={{ fill: "currentColor", opacity: 0.55 }}
            />
            <YAxis
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(value) => `${value}`}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: "currentColor", opacity: 0.55 }}
              width={34}
            />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <Line
              dataKey="value"
              dot={false}
              stroke="var(--color-value)"
              strokeWidth={2.75}
              type="monotone"
              activeDot={{ r: 4 }}
            />
            <Line
              dataKey="comparison"
              dot={false}
              stroke="var(--color-comparison)"
              strokeDasharray="5 5"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
