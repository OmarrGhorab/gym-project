"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { LiveAttendanceData } from "./data";

const chartConfig = {
  total: {
    color: "var(--chart-3)",
    label: "Total",
  },
} satisfies ChartConfig;

export function RealtimeVisitors({ data }: { data: LiveAttendanceData }) {
  const recentHours = data.hourly.filter((point) => point.total > 0).slice(-12);
  const chartData = recentHours.length > 0 ? recentHours : data.hourly.slice(0, 12);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal">Live Presence</CardTitle>
        <CardDescription>Current scan-based count inside the gym.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-4xl tabular-nums leading-none tracking-tight">{data.currently_inside.total}</div>
            <div className="text-muted-foreground text-sm">people currently inside</div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            Live
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
            <div className="text-muted-foreground text-xs">Members</div>
            <div className="text-2xl tabular-nums">{data.currently_inside.members}</div>
          </div>
          <div className="space-y-1 p-4">
            <div className="text-muted-foreground text-xs">Staff</div>
            <div className="text-2xl tabular-nums">{data.currently_inside.staff}</div>
          </div>
          <div className="space-y-1 border-t border-r p-4">
            <div className="text-muted-foreground text-xs">Blocked</div>
            <div className="text-2xl tabular-nums">{data.today.blocked_visits}</div>
          </div>
          <div className="space-y-1 border-t p-4">
            <div className="text-muted-foreground text-xs">Flagged</div>
            <div className="text-2xl tabular-nums">{data.today.flagged_scans}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
