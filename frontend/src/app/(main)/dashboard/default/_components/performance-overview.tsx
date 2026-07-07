"use client";

import { useCallback, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { DateRangePicker } from "@/components/date-range-picker";
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
  memberships: number;
  revenue: number;
  sales: number;
  units: number;
};

type SegmentValue = "all" | "orders" | "products" | "memberships";
type DateShortcutValue = "custom" | "last24Hours" | "last7Days" | "last30Days" | "last3Months" | "last12Months";

export function PerformanceOverview({ data }: { data: SalesChartPoint[] }) {
  const t = useTranslations("Dashboard.default.charts");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [segment, setSegment] = useState<SegmentValue>("all");

  const dateRange: DateRange = useMemo(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    return {
      from: from ? parseISO(from) : undefined,
      to: to ? parseISO(to) : undefined,
    };
  }, [searchParams]);
  const dateShortcut = useMemo(
    () => getDateShortcutValue(searchParams.get("from"), searchParams.get("to")),
    [searchParams],
  );

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (range?.from) {
        params.set("from", formatDate(range.from));
      } else {
        params.delete("from");
      }
      if (range?.to) {
        params.set("to", formatDate(range.to));
      } else {
        params.delete("to");
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );
  const handleDateShortcutChange = useCallback(
    (value: string | null) => {
      if (!isDateShortcutValue(value) || value === "custom") {
        return;
      }

      const range = getDateShortcutRange(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", range.from);
      params.set("to", range.to);
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    if (segment === "all" || segment === "orders") {
      cfg.revenue = { label: t("revenue"), color: "var(--chart-1)" };
    }
    if (segment === "all" || segment === "orders") {
      cfg.sales = { label: t("sales"), color: "var(--chart-2)" };
    }
    if (segment === "all" || segment === "products") {
      cfg.units = { label: t("unitsSold"), color: "var(--chart-3)" };
    }
    if (segment === "all" || segment === "memberships") {
      cfg.memberships = { label: t("membershipSubscriptions"), color: "var(--chart-4)" };
    }
    return cfg satisfies ChartConfig;
  }, [segment, t]);

  const showRevenue = segment === "all" || segment === "orders";
  const showSales = segment === "all" || segment === "orders";
  const showUnits = segment === "all" || segment === "products";
  const showMemberships = segment === "all" || segment === "memberships";

  const performanceSegmentItems = useMemo(() => {
    const items: { value: SegmentValue; label: string }[] = [
      { value: "all", label: getPerformanceSegmentLabel("all", t) },
      { value: "orders", label: getPerformanceSegmentLabel("orders", t) },
      { value: "products", label: getPerformanceSegmentLabel("products", t) },
      { value: "memberships", label: getPerformanceSegmentLabel("memberships", t) },
    ];
    return items;
  }, [t]);

  const handleSegmentChange = (value: string | null) => {
    if (value === "all" || value === "orders" || value === "products" || value === "memberships") {
      setSegment(value);
    }
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">{t("salesActivity")}</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">{t("salesActivityWide")}</span>
          <span className="@[540px]/card:hidden">{t("salesActivityNarrow")}</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />

          <Select value={dateShortcut} onValueChange={handleDateShortcutChange}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("period")}</SelectLabel>
                {dateShortcutItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={segment} onValueChange={handleSegmentChange}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
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

          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/ecommerce")}>
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
              hide={!showRevenue}
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
              hide={!showSales && !showUnits && !showMemberships}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />

            {showRevenue && (
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
            )}
            {showSales && (
              <Line
                yAxisId="count"
                dataKey="sales"
                type="natural"
                stroke="var(--color-sales)"
                strokeWidth={1.4}
                dot={false}
              />
            )}
            {showUnits && (
              <Line
                yAxisId="count"
                dataKey="units"
                type="natural"
                stroke="var(--color-units)"
                strokeWidth={1.2}
                dot={false}
              />
            )}
            {showMemberships && (
              <Line
                yAxisId="count"
                dataKey="memberships"
                type="natural"
                stroke="var(--color-memberships)"
                strokeWidth={1.4}
                dot={false}
              />
            )}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function getPerformanceSegmentLabel(value: SegmentValue, t: ReturnType<typeof useTranslations>) {
  if (value === "all") {
    return t("allSales");
  }

  if (value === "orders") {
    return t("orders");
  }

  if (value === "products") {
    return t("products");
  }

  return t("memberships");
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const dateShortcutItems = [
  { value: "custom", labelKey: "customRange" },
  { value: "last24Hours", labelKey: "last24Hours" },
  { value: "last7Days", labelKey: "last7Days" },
  { value: "last30Days", labelKey: "last30Days" },
  { value: "last3Months", labelKey: "lastThreeMonths" },
  { value: "last12Months", labelKey: "last12Months" },
] as const satisfies ReadonlyArray<{ value: DateShortcutValue; labelKey: string }>;

function isDateShortcutValue(value: string | null): value is DateShortcutValue {
  return dateShortcutItems.some((item) => item.value === value);
}

function getDateShortcutValue(from: string | null, to: string | null): DateShortcutValue {
  if (!from || !to) {
    return "custom";
  }

  for (const item of dateShortcutItems) {
    if (item.value === "custom") {
      continue;
    }

    const range = getDateShortcutRange(item.value);

    if (range.from === from && range.to === to) {
      return item.value;
    }
  }

  return "custom";
}

function getDateShortcutRange(value: Exclude<DateShortcutValue, "custom">) {
  const today = new Date();
  const to = formatDate(today);

  switch (value) {
    case "last24Hours":
      return { from: formatDate(addDays(today, -1)), to };
    case "last7Days":
      return { from: formatDate(addDays(today, -6)), to };
    case "last30Days":
      return { from: formatDate(addDays(today, -29)), to };
    case "last3Months":
      return { from: formatDate(addMonths(today, -3)), to };
    case "last12Months":
      return { from: formatDate(addMonths(today, -12)), to };
  }
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);

  return nextDate;
}
