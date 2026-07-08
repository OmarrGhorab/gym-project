"use client";

import { useLocale, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";

import type { FinanceChartPoint } from "./data";

export function TransactionsOverviewCard({ chart }: { chart: FinanceChartPoint[] }) {
  const t = useTranslations("Dashboard.finance");
  const locale = useLocale();

  const chartConfig = {
    revenue: {
      color: "var(--chart-2)",
      label: t("revenue"),
    },
    expenses: {
      color: "var(--chart-4)",
      label: t("expenses"),
    },
    netProfit: {
      color: "var(--chart-3)",
      label: t("netProfit"),
    },
  } satisfies ChartConfig;

  const chartData = chart
    .map((point) => {
      const isMonthly = /^\d{4}-\d{2}$/.test(point.period);
      const date = isMonthly ? Date.parse(`${point.period}-01T00:00:00Z`) : Date.parse(`${point.period}T00:00:00Z`);

      return {
        period: point.period,
        label: isMonthly ? formatMonthOnly(point.period, locale) : formatDayOnly(point.period, locale),
        date,
        expenses: Number(point.expenses),
        netProfit: Number(point.net_profit),
        revenue: Number(point.revenue),
      };
    })
    .filter((point) => Number.isFinite(point.date));

  return (
    <Card id="finance-overview">
      <CardHeader>
        <CardTitle className="font-normal">{t("financeOverview")}</CardTitle>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-50 w-full">
          <LineChart accessibilityLayer data={chartData} margin={{ bottom: 20, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={8}
              tick={{ fontSize: 11, fill: "#888888" }}
              interval={Math.max(0, Math.ceil(chartData.length / 8) - 1)}
              height={30}
            />
            <YAxis hide axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload, label }) => (
                <ChartTooltipContent
                  active={active}
                  label={label}
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

function formatMonthOnly(period: string, locale: string) {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

function formatDayOnly(period: string, locale: string) {
  const date = new Date(`${period}T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}
