"use client";

import { parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

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

const performancePeriodValues = ["quarter", "year"] as const;
const performanceSegmentValues = ["all", "orders", "products"] as const;

export function PerformanceOverview({ data }: { data: SalesChartPoint[] }) {
  const t = useTranslations("Dashboard.default.charts");
  const locale = useLocale();
  const chartConfig = {
    revenue: {
      label: t("revenue"),
      color: "var(--chart-1)",
    },
    sales: {
      label: t("sales"),
      color: "var(--chart-2)",
    },
    units: {
      label: t("unitsSold"),
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig;
  const performancePeriodItems = performancePeriodValues.map((value) => ({
    value,
    label: value === "year" ? t("twelveMonths") : t("threeMonths"),
  }));
  const performanceSegmentItems = performanceSegmentValues.map((value) => ({
    value,
    label: getPerformanceSegmentLabel(value, t),
  }));

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">{t("salesActivity")}</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">{t("salesActivityWide")}</span>
          <span className="@[540px]/card:hidden">{t("lastThreeMonths")}</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select defaultValue="year" items={performancePeriodItems}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder={t("twelveMonths")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("period")}</SelectLabel>
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
              <SelectValue placeholder={t("allSales")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("segments")}</SelectLabel>
                {performanceSegmentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            {t("viewReport")}
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
                parseISO(value).toLocaleDateString(locale, {
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
                  labelFormatter={(value) =>
                    new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(parseISO(value))
                  }
                />
              }
            />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />

            <YAxis
              yAxisId="revenue"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => {
                if (value >= 1000) return `${Math.round(value / 1000)}k`;
                return String(value);
              }}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />

            <Area
              yAxisId="revenue"
              dataKey="revenue"
              type="natural"
              fill="url(#fillRevenue)"
              stroke="var(--color-revenue)"
              strokeWidth={1.25}
              dot={false}
              fillOpacity={1}
            />
            <Line yAxisId="count" dataKey="sales" type="natural" stroke="var(--color-sales)" strokeWidth={1.4} dot={false} />
            <Line yAxisId="count" dataKey="units" type="natural" stroke="var(--color-units)" strokeWidth={1.2} dot={false} />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function getPerformanceSegmentLabel(
  value: (typeof performanceSegmentValues)[number],
  t: ReturnType<typeof useTranslations>,
) {
  if (value === "all") {
    return t("allSales");
  }

  if (value === "orders") {
    return t("orders");
  }

  return t("products");
}
