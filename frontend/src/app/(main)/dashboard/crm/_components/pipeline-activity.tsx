"use client";

import * as React from "react";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

import type { MembershipSummary } from "./data";

export type MembershipChartPoint = {
  date: string;
  revenue: number;
  sales: number;
  units: number;
};

const pipelineChartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const pipelineRangeItems = [
  { value: "last-30-days", label: "Last 30 days" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "last-12-months", label: "Last 12 months" },
] as const;

type PipelineRange = (typeof pipelineRangeItems)[number]["value"];

const axisMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const tooltipMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

export function PipelineActivity({ data, summary }: { data: MembershipChartPoint[]; summary: MembershipSummary }) {
  const [range, setRange] = React.useState<PipelineRange>("last-12-months");
  const filteredData = React.useMemo(() => filterChartData(data, range), [data, range]);
  const selectedRange = pipelineRangeItems.find((item) => item.value === range) ?? pipelineRangeItems[2];
  const rangeRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);
  const rangeSales = filteredData.reduce((sum, item) => sum + item.sales, 0);
  const dueProgress = rangeRevenue > 0 ? Math.round((summary.outstandingDuesTotal / rangeRevenue) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-12">
        <CardHeader>
          <CardTitle>Membership Revenue Flow</CardTitle>
          <CardAction>
            <Select
              value={range}
              onValueChange={(value) => setRange(value as PipelineRange)}
              items={pipelineRangeItems}
            >
              <SelectTrigger size="sm" className="min-w-40">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pipelineRangeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <ChartContainer config={pipelineChartConfig} className="h-72 w-full lg:col-span-8">
              <BarChart data={filteredData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barSize={38}>
                <defs>
                  <pattern
                    id="crm-qualified-pattern"
                    width="4"
                    height="4"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill="var(--color-revenue)" fillOpacity="0.15" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="6"
                      stroke="var(--color-revenue)"
                      strokeWidth="1.25"
                      strokeOpacity="0.40"
                    />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="0" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => axisMonthFormatter.format(new Date(String(value)))}
                />
                <YAxis hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(value) => tooltipMonthFormatter.format(new Date(String(value)))}
                    />
                  }
                />
                <Bar
                  dataKey="revenue"
                  fill="url(#crm-qualified-pattern)"
                  radius={[8, 8, 0, 0]}
                  stroke="var(--color-revenue)"
                  strokeOpacity={0.5}
                  strokeWidth={0.5}
                />
              </BarChart>
            </ChartContainer>

            <div className="flex flex-col gap-5 rounded-lg p-4 lg:col-span-4">
              <div className="flex flex-col gap-1">
                <div className="font-medium text-4xl tabular-nums leading-none">
                  {formatCurrency(rangeRevenue, { currency: "EGP", noDecimals: true })}{" "}
                  <span className="font-normal text-lg text-muted-foreground">revenue</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Completed sales and POS activity for {selectedRange.label.toLowerCase()}.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Balances To Collect</div>

                <div className="flex flex-col gap-1.5">
                  <div className="font-medium text-2xl tabular-nums leading-none">
                    {formatCurrency(summary.outstandingDuesTotal, { currency: "EGP", noDecimals: true })}{" "}
                    <span className="font-normal text-muted-foreground text-sm">due</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {summary.outstandingDuesCount} member balances need follow-up.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-0.5">
                  <Progress
                    value={Math.min(dueProgress, 100)}
                    className="h-2.5 bg-chart-2/12 *:data-[slot='progress-indicator']:bg-chart-2"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-medium tabular-nums">{Math.min(dueProgress, 100)}% due ratio</div>
                    <div className="text-muted-foreground tabular-nums">{rangeSales} sales</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function filterChartData(data: MembershipChartPoint[], range: PipelineRange) {
  if (range === "last-30-days") {
    return data.slice(-1);
  }

  if (range === "last-quarter") {
    return data.slice(-3);
  }

  return data.slice(-12);
}
