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
import type { FinancialReportRow } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

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
  className,
}: {
  rows?: FinancialReportRow[];
  locale?: string;
  emptyMessage: string;
  className?: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div
        className={cn(
          "grid h-80 place-items-center rounded-[8px] border border-dashed bg-background/50 text-sm font-semibold text-muted-foreground",
          className
        )}
      >
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
    <ChartContainer config={chartConfig} className={cn("h-80 w-full", className)}>
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 18, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.55} />
            <stop offset="64%" stopColor="var(--color-primary)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--color-border)"
          strokeDasharray="3 6"
        />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          tickFormatter={(value) =>
            format(parseISO(value), "d", { locale: dateLocale })
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
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
          strokeWidth={3}
          strokeLinecap="round"
          fill="url(#fillRevenue)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "var(--color-primary)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
