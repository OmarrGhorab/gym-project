"use client";

import { format, parseISO } from "date-fns";
import { ArrowUpRight, DollarSign, PackageCheck, ReceiptText, ShoppingBag, TriangleAlert, Users } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { PosChartPoint, PosDashboardData } from "./data";
import { formatEgp, formatSignedPercent } from "./format";

const revenueOverviewConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--foreground)",
  },
  orders: {
    label: "Orders",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

function formatTick(value: string) {
  const date = parseISO(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "d");
}

function formatTooltipLabel(value: string) {
  const date = parseISO(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "do MMMM yyyy");
}

function metricClass(value: string) {
  return Number(value) < 0 ? "text-destructive" : "text-green-700 dark:text-green-300";
}

export function KpiStrip({ chart, totals }: { chart: PosChartPoint[]; totals: PosDashboardData["totals"] }) {
  const chartData = chart.map((point) => ({
    ...point,
    revenue: Number(point.revenue),
  }));
  const metrics = [
    {
      title: "POS Sales",
      value: formatEgp(totals.sales),
      detail: `${formatSignedPercent(totals.sales_growth_rate)} vs last month`,
      trend: totals.sales_growth_rate,
      icon: DollarSign,
    },
    {
      title: "Orders",
      value: totals.orders.toLocaleString(),
      detail: `${formatSignedPercent(totals.orders_growth_rate)} vs last month`,
      trend: totals.orders_growth_rate,
      icon: ShoppingBag,
    },
    {
      title: "Members Buying",
      value: totals.member_buyers.toLocaleString(),
      detail: "unique member buyers",
      trend: "0",
      icon: Users,
    },
    {
      title: "Average Sale",
      value: formatEgp(totals.average_sale),
      detail: "per POS checkout",
      trend: "0",
      icon: ReceiptText,
    },
    {
      title: "Low Stock",
      value: totals.low_stock_products.toLocaleString(),
      detail: "products need restock",
      trend: "-1",
      icon: TriangleAlert,
    },
    {
      title: "Availability",
      value: `${totals.availability_rate}%`,
      detail: "active products stocked",
      trend: "1",
      icon: PackageCheck,
    },
  ] as const;

  return (
    <div className="h-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 xl:col-span-12">
      <div>
        <div className="grid grid-cols-1 xl:grid-cols-12">
          <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-3 xl:col-span-5 xl:border-r">
            {metrics.map((metric) => (
              <Card
                className="h-full rounded-none border-0 border-border border-b ring-0 odd:md:border-r xl:nth-[n+5]:border-b-0"
                key={metric.title}
              >
                <CardHeader>
                  <CardTitle className="font-normal text-sm">{metric.title}</CardTitle>
                  <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
                    {metric.value}
                  </CardDescription>
                  <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">
                    <metric.icon className="size-3 text-foreground" />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <span className={metricClass(metric.trend)}>{metric.detail.split(" ")[0]}</span>
                    <span className="text-muted-foreground"> {metric.detail.split(" ").slice(1).join(" ")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="h-full rounded-none border-0 ring-0 xl:col-span-7">
            <CardHeader>
              <CardTitle className="font-normal">POS Sales Overview</CardTitle>
              <CardAction>
                <ArrowUpRight className="size-4" />
              </CardAction>
            </CardHeader>

            <CardContent>
              <ChartContainer config={revenueOverviewConfig} className="h-74 w-full">
                <ComposedChart accessibilityLayer data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
                  <CartesianGrid yAxisId="orders" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    height={30}
                    minTickGap={12}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => formatTick(String(value))}
                  />
                  <YAxis yAxisId="revenue" hide />
                  <YAxis yAxisId="orders" hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-44"
                        labelFormatter={(value) => formatTooltipLabel(String(value))}
                        formatter={(value, name, item) => (
                          <>
                            <div className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                            <div className="flex flex-1 items-center justify-between leading-none">
                              <span className="text-muted-foreground">{String(name ?? "")}</span>
                              <span className="font-medium font-mono text-foreground tabular-nums">
                                {name === "revenue" ? formatEgp(Number(value)) : String(value)}
                              </span>
                            </div>
                          </>
                        )}
                      />
                    }
                    cursor={{
                      stroke: "var(--border)",
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Bar
                    yAxisId="orders"
                    barSize={4}
                    dataKey="orders"
                    fill="var(--color-orders)"
                    name="Orders"
                    opacity={0.2}
                    radius={[6, 6, 0, 0]}
                  />
                  <Area
                    yAxisId="revenue"
                    dataKey="revenue"
                    fill="none"
                    name="Revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={1.8}
                    type="linear"
                    activeDot={{
                      r: 4,
                      fill: "var(--background)",
                      stroke: "var(--color-revenue)",
                      strokeWidth: 2,
                    }}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
