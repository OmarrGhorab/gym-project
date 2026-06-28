"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

import type { FinanceChartPoint } from "./data";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

const chartConfig = {
  revenue: {
    color: "var(--chart-2)",
    label: "Revenue",
  },
  expenses: {
    color: "var(--chart-4)",
    label: "Expenses",
  },
  netProfit: {
    color: "var(--chart-3)",
    label: "Net profit",
  },
} satisfies ChartConfig;

export function TransactionsOverviewCard({ chart }: { chart: FinanceChartPoint[] }) {
  const chartData = chart
    .map((point) => ({
      period: point.period,
      date: Date.parse(`${point.period}-01T00:00:00Z`),
      expenses: Number(point.expenses),
      netProfit: Number(point.net_profit),
      revenue: Number(point.revenue),
    }))
    .filter((point) => Number.isFinite(point.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Finance Overview</CardTitle>
        <CardAction>
          <Select defaultValue="monthly">
            <SelectTrigger className="w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-50 w-full">
          <LineChart accessibilityLayer data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              scale="time"
              tickFormatter={formatMonthLabel}
              tickLine={false}
              tickMargin={10}
              tick={{ fontSize: 12 }}
              type="number"
            />
            <YAxis hide axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload, label }) => (
                <ChartTooltipContent
                  active={active}
                  label={label}
                  labelFormatter={formatMonthLabel}
                  payload={payload?.map((item) => ({
                    ...item,
                    value:
                      typeof item.value === "number"
                        ? formatCurrency(item.value, { currency: "EGP", noDecimals: true })
                        : item.value,
                  }))}
                />
              )}
            />
            <Line
              connectNulls
              dataKey="revenue"
              dot={false}
              stroke="var(--color-revenue)"
              strokeLinecap="round"
              strokeWidth={2}
              type="linear"
            />
            <Line
              connectNulls
              dataKey="netProfit"
              dot={false}
              stroke="var(--color-netProfit)"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeWidth={2}
              type="linear"
            />
            <Line
              dataKey="expenses"
              dot={false}
              stroke="var(--color-expenses)"
              strokeLinecap="round"
              strokeWidth={3}
              type="linear"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function formatMonthLabel(value: unknown) {
  const timestamp = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(timestamp)) {
    return monthFormatter.format(new Date(timestamp));
  }

  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    return monthFormatter.format(new Date(`${value}-01T00:00:00Z`));
  }

  return String(value ?? "");
}
