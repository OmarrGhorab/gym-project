"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { arEG, enUS } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent } from "@/components/ui/card";
import type { FinancialReportRow } from "@/lib/api/dashboard";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

const locales = {
  ar: arEG,
  en: enUS,
};

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
  });
}

export function RevenueChart({
  rows,
  locale = "en",
  emptyMessage,
}: {
  rows?: FinancialReportRow[];
  locale?: string;
  emptyMessage: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const dateLocale = locales[locale as keyof typeof locales] ?? enUS;
  const data = rows.map((row) => ({
    period: row.period,
    revenue: parseFloat(row.revenue) || 0,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value) =>
            format(parseISO(value), "d", { locale: dateLocale })
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
          }
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(Number(value), locale)}
                </span>
              )}
              labelFormatter={(_, payload) => {
                const period = payload?.[0]?.payload?.period;
                if (!period) return "";
                return format(parseISO(period), "PPP", { locale: dateLocale });
              }}
            />
          }
        />
        <Area
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#fillRevenue)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
