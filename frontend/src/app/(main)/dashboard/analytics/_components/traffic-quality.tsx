"use client";

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
  } satisfies ChartConfig;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">{t("hourlyOccupancy")}</CardTitle>
        <CardDescription>{t("hourlyOccupancyDescription")}</CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-80 w-full">
          <LineChart data={data} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="hour" axisLine={false} interval={2} tickLine={false} tickMargin={12} />
            <YAxis axisLine={false} allowDecimals={false} tickLine={false} tickMargin={10} width={34} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <Line
              dataKey="total"
              dot={false}
              stroke="var(--color-total)"
              strokeWidth={2.5}
              type="monotone"
              activeDot={{ r: 4 }}
            />
            <Line dataKey="members" dot={false} stroke="var(--color-members)" strokeWidth={2} type="monotone" />
            <Line
              dataKey="staff"
              dot={false}
              stroke="var(--color-staff)"
              strokeDasharray="4 4"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
