"use client";

import { format, parseISO } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SalesChartPoint = {
  date: string;
  revenue: number;
  sales: number;
  units: number;
};

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
  sales: {
    label: "Sales",
    color: "var(--chart-2)",
  },
  units: {
    label: "Units Sold",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const performancePeriodItems = [{ value: "quarter", label: "3 months" }] as const;

const performanceSegmentItems = [
  { value: "all", label: "All sales" },
  { value: "orders", label: "Orders" },
  { value: "products", label: "Products" },
] as const;

export function PerformanceOverview({ data }: { data: SalesChartPoint[] }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Sales Activity</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Revenue, orders, and product units for the last 90 days</span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select defaultValue="quarter" items={performancePeriodItems}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="3 months" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Period</SelectLabel>
                {performancePeriodItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="all" items={performanceSegmentItems}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="All segments" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Segments</SelectLabel>
                {performanceSegmentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            View report
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
          <ComposedChart data={data} margin={{ top: 0 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.36} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={48}
              tickFormatter={(value) =>
                parseISO(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="w-50"
                  indicator="line"
                  labelFormatter={(value) => format(parseISO(value), "d MMMM yyyy")}
                />
              }
            />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />

            <Area
              dataKey="revenue"
              type="natural"
              fill="url(#fillRevenue)"
              stroke="var(--color-revenue)"
              strokeWidth={1.25}
              dot={false}
              fillOpacity={1}
            />
            <Line dataKey="sales" type="natural" stroke="var(--color-sales)" strokeWidth={1.4} dot={false} />
            <Line dataKey="units" type="natural" stroke="var(--color-units)" strokeWidth={1.2} dot={false} />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
