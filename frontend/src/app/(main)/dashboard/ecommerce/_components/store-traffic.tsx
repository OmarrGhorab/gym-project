"use client";

import { ArrowUpRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import type { PosHourlyPoint } from "./data";
import { formatEgp } from "./format";

const trafficConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-3)",
  },
  orders: {
    label: "Orders",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

export function StoreTraffic({ data }: { data: PosHourlyPoint[] }) {
  const chartData = data.map((point) => ({
    ...point,
    revenue: Number(point.revenue),
  }));
  const totalOrders = data.reduce((sum, point) => sum + point.orders, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">POS Activity</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {totalOrders.toLocaleString()} orders today
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={trafficConfig} className="h-54 w-full">
          <AreaChart accessibilityLayer data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
            <defs>
              <linearGradient id="fillPosRevenue" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} tickMargin={10} />
            <YAxis axisLine={false} tickLine={false} tickMargin={6} width={36} yAxisId="revenue" />
            <YAxis hide yAxisId="orders" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (name === "revenue" ? formatEgp(Number(value)) : String(value))}
                />
              }
              cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            />
            <ChartLegend align="right" verticalAlign="top" className="justify-end" content={<ChartLegendContent />} />
            <Area
              dataKey="revenue"
              dot={false}
              fill="url(#fillPosRevenue)"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              type="stepAfter"
              yAxisId="revenue"
            />
            <Line
              dataKey="orders"
              dot={false}
              stroke="var(--color-orders)"
              strokeLinecap="round"
              strokeWidth={1.2}
              type="stepAfter"
              yAxisId="orders"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
