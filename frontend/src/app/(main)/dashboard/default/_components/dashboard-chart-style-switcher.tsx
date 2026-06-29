"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Funnel,
  FunnelChart,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency } from "@/lib/utils";

import type { DashboardSummary } from "./data";
import { PerformanceOverview, type SalesChartPoint } from "./performance-overview";

type ChartStyle = "default" | "crm-v1" | "finance-v1";

type DashboardChartStyleSwitcherProps = {
  data: SalesChartPoint[];
  summary: DashboardSummary;
};

const storageKey = "dashboard.default.chartStyle";

const chartStyleValues = ["default", "crm-v1", "finance-v1"] as const;

export function DashboardChartStyleSwitcher({ data, summary }: DashboardChartStyleSwitcherProps) {
  const t = useTranslations("Dashboard.default.charts");
  const [style, setStyle] = useState<ChartStyle>("default");
  const chartStyleOptions = chartStyleValues.map((value) => ({
    label: getChartStyleLabel(value, t),
    value,
  }));

  useEffect(() => {
    const savedStyle = window.localStorage.getItem(storageKey);

    if (isChartStyle(savedStyle)) {
      setStyle(savedStyle);
    }
  }, []);

  const handleStyleChange = (value: ChartStyle | null) => {
    const nextStyle = isChartStyle(value) ? value : "default";

    setStyle(nextStyle);
    window.localStorage.setItem(storageKey, nextStyle);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <ChartNoAxesCombined className="size-4" />
          <span>{t("styleHelp")}</span>
        </div>

        <Select value={style} onValueChange={handleStyleChange} items={chartStyleOptions}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder={t("styleLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t("styleLabel")}</SelectLabel>
              {chartStyleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {style === "default" ? <PerformanceOverview data={data} /> : null}
      {style === "crm-v1" ? <CrmV1SalesStyle data={data} summary={summary} /> : null}
      {style === "finance-v1" ? <FinanceV1SalesStyle data={data} /> : null}
    </div>
  );
}

function CrmV1SalesStyle({ data, summary }: DashboardChartStyleSwitcherProps) {
  const t = useTranslations("Dashboard.default.charts");
  const locale = useLocale();
  const compactBars = useMemo(() => toCompactBarData(data), [data]);
  const revenueLine = useMemo(() => toMonthlyRevenueData(data, locale), [data, locale]);
  const totals = useMemo(() => getTotals(data), [data]);
  const gymBreakdown = useMemo(() => toGymBreakdown(summary, totals, t), [summary, totals, t]);
  const targetRows = useMemo(() => toRevenueTargetRows(data, totals, locale), [data, totals, locale]);
  const pipelineRows = useMemo(() => toMembershipFunnel(summary, totals, t), [summary, totals, t]);
  const sourceRows = useMemo(() => toGymSourceRows(summary, totals, t), [summary, totals, t]);
  const actionItems = useMemo(() => toGymActionItems(summary, t), [summary, t]);
  const revenueGrowth = Number(summary.revenue_growth_rate ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs md:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("gymVisitsValue")}</CardTitle>
            <CardDescription>{t("last90Days")}</CardDescription>
          </CardHeader>
          <CardContent className="size-full">
            <ChartContainer className="size-full min-h-24" config={crmMiniBarConfig}>
              <BarChart accessibilityLayer data={compactBars} barSize={8}>
                <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false} hide />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar
                  background={{ fill: "var(--color-background)", radius: 4, opacity: 0.08 }}
                  dataKey="orders"
                  stackId="a"
                  fill="var(--color-orders)"
                />
                <Bar dataKey="units" stackId="a" fill="var(--color-units)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <span className="font-semibold text-xl tabular-nums">{totals.sales.toLocaleString(locale)}</span>
            <TrendPill value={revenueGrowth} />
          </CardFooter>
        </Card>

        <Card className="overflow-hidden pb-0">
          <CardHeader>
            <CardTitle>{t("orderMomentum")}</CardTitle>
            <CardDescription>{t("dailyTransactions")}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ChartContainer className="size-full min-h-24" config={crmAreaConfig}>
              <AreaChart data={data} margin={{ left: 0, right: 0, top: 5 }}>
                <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent hideIndicator labelFormatter={(value) => formatTooltipDate(value, locale)} />
                  }
                />
                <Area
                  dataKey="sales"
                  fill="var(--color-sales)"
                  fillOpacity={0.05}
                  stroke="var(--color-sales)"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-fit rounded-lg bg-green-500/10 p-2">
              <ArrowDownLeft className="size-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="flex size-full flex-col justify-between">
            <div className="space-y-1.5">
              <CardTitle>{t("revenue")}</CardTitle>
              <CardDescription>{t("selectedRange")}</CardDescription>
            </div>
            <p className="font-medium text-2xl tabular-nums">
              {formatCurrency(totals.revenue, { currency: "EGP", noDecimals: true })}
            </p>
            <TrendPill value={revenueGrowth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-fit rounded-lg bg-primary/10 p-2">
              <ArrowUpRight className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="flex size-full flex-col justify-between">
            <div className="space-y-1.5">
              <CardTitle>{t("unitsSold")}</CardTitle>
              <CardDescription>{t("productsFromPos")}</CardDescription>
            </div>
            <p className="font-medium text-2xl tabular-nums">{totals.units.toLocaleString(locale)}</p>
            <Badge variant="secondary">{t("gymPos")}</Badge>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>{t("revenueGrowth")}</CardTitle>
            <CardDescription>{t("monthlyGymSalesTrend")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={crmRevenueConfig} className="h-24 w-full">
              <LineChart data={revenueLine} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  strokeWidth={2}
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-sm">{t("backendSalesNote")}</p>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs xl:grid-cols-5">
        <GymBreakdownDonut rows={gymBreakdown} />
        <RevenueTargetBars rows={targetRows} />
      </div>

      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs xl:grid-cols-3">
        <MembershipFunnel rows={pipelineRows} summary={summary} />
        <GymSourceBreakdown rows={sourceRows} />
        <GymActionItems items={actionItems} />
      </div>
    </div>
  );
}

function FinanceV1SalesStyle({ data }: { data: SalesChartPoint[] }) {
  const t = useTranslations("Dashboard.default.charts");
  const locale = useLocale();
  const monthly = useMemo(() => toMonthlyCashFlowData(data, locale), [data, locale]);
  const totalIncome = monthly.reduce((sum, item) => sum + item.income, 0);
  const totalCostBasis = monthly.reduce((sum, item) => sum + Math.abs(item.costBasis), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gymCashFlowOverview")}</CardTitle>
        <CardDescription>{t("cashFlowDescription")}</CardDescription>
        <CardAction>
          <Badge variant="outline">{t("financeV1Style")}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Separator />
        <div className="flex items-start justify-between gap-2 py-5 md:items-stretch md:gap-0">
          <div className="flex flex-1 items-center justify-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chart-1">
              <ArrowDownLeft className="size-6 stroke-background" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase">{t("income")}</p>
              <p className="font-medium tabular-nums">
                {formatCurrency(totalIncome, { currency: "EGP", noDecimals: true })}
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-auto! self-stretch" />
          <div className="flex flex-1 items-center justify-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chart-2">
              <ArrowUpRight className="size-6 stroke-background" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase">{t("activityBasis")}</p>
              <p className="font-medium tabular-nums">
                {formatCurrency(totalCostBasis, { currency: "EGP", noDecimals: true })}
              </p>
            </div>
          </div>
        </div>
        <Separator />
        <ChartContainer className="max-h-72 w-full" config={financeCashFlowConfig}>
          <BarChart
            stackOffset="sign"
            margin={{ left: -25, right: 0, top: 25, bottom: 0 }}
            accessibilityLayer
            data={monthly}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
            <YAxis axisLine={false} tickLine={false} tickMargin={8} tickFormatter={formatCompactAxis} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="income" stackId="a" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="costBasis" stackId="a" fill="var(--color-costBasis)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function GymBreakdownDonut({ rows }: { rows: GymBreakdownRow[] }) {
  const t = useTranslations("Dashboard.default.charts");
  const locale = useLocale();
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>{t("gymMixBySource")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
        <ChartContainer config={gymBreakdownConfig} className="mx-auto aspect-square max-h-48 flex-1">
          <PieChart className="m-0" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={rows}
              dataKey="value"
              nameKey="source"
              innerRadius={65}
              outerRadius={90}
              paddingAngle={2}
              cornerRadius={4}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground font-bold text-3xl tabular-nums"
                        >
                          {total.toLocaleString(locale)}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                          {t("total")}
                        </tspan>
                      </text>
                    );
                  }

                  return null;
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <ul className="flex min-w-40 flex-col gap-3">
          {rows.map((item) => (
            <li key={item.source} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-xs">
                <span className="size-2.5 rounded-full" style={{ background: item.fill }} />
                {item.label}
              </span>
              <span className="text-xs tabular-nums">{item.value.toLocaleString(locale)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground text-xs">{t("gymMixNote")}</p>
      </CardFooter>
    </Card>
  );
}

function RevenueTargetBars({ rows }: { rows: RevenueTargetRow[] }) {
  const t = useTranslations("Dashboard.default.charts");
  const averageProgress =
    rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0;
  const aboveTarget = rows.filter((row) => row.progress >= 100).length;

  return (
    <Card className="xl:col-span-3">
      <CardHeader>
        <CardTitle>{t("gymRevenueVsTarget")}</CardTitle>
      </CardHeader>
      <CardContent className="size-full max-h-56">
        <ChartContainer config={revenueTargetConfig} className="size-full">
          <BarChart accessibilityLayer data={rows} layout="vertical">
            <CartesianGrid horizontal={false} />
            <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} hide />
            <XAxis dataKey="actual" type="number" hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Bar stackId="a" dataKey="actual" fill="var(--color-actual)">
              <LabelList dataKey="name" position="insideLeft" offset={8} className="fill-primary-foreground text-xs" />
              <LabelList
                dataKey="actual"
                position="insideRight"
                offset={8}
                className="fill-primary-foreground text-xs tabular-nums"
              />
            </Bar>
            <Bar stackId="a" dataKey="remaining" fill="var(--color-remaining)" radius={[0, 6, 6, 0]}>
              <LabelList
                dataKey="remaining"
                position="insideRight"
                offset={8}
                className="fill-primary-foreground text-xs tabular-nums"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground text-xs">{t("targetProgress", { averageProgress, aboveTarget })}</p>
      </CardFooter>
    </Card>
  );
}

function MembershipFunnel({ rows, summary }: { rows: FunnelRow[]; summary: DashboardSummary }) {
  const t = useTranslations("Dashboard.default.charts");
  const memberGrowth = Number(summary.new_members_growth_rate ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("membershipPipeline")}</CardTitle>
      </CardHeader>
      <CardContent className="size-full min-h-72">
        <ChartContainer config={membershipFunnelConfig} className="size-full">
          <FunnelChart margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
            <Funnel className="stroke-2 stroke-card" dataKey="value" data={rows}>
              <LabelList className="fill-foreground stroke-0" dataKey="stage" position="right" offset={10} />
              <LabelList className="fill-foreground stroke-0" dataKey="value" position="left" offset={10} />
            </Funnel>
          </FunnelChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground text-xs">
          {t("newMembersChanged", { value: formatSignedPercent(memberGrowth) })}
        </p>
      </CardFooter>
    </Card>
  );
}

function GymSourceBreakdown({ rows }: { rows: SourceBreakdownRow[] }) {
  const t = useTranslations("Dashboard.default.charts");
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gymBreakdown")}</CardTitle>
        <CardDescription className="font-medium tabular-nums">
          {formatCurrency(total, { currency: "EGP", noDecimals: true })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.name} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{row.name}</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-sm tabular-nums">
                    {formatCurrency(row.amount, { currency: "EGP", noDecimals: true })}
                  </span>
                  <span
                    className={cn(
                      "font-medium text-xs tabular-nums",
                      row.isPositive ? "text-green-500" : "text-destructive",
                    )}
                  >
                    {row.growth}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={row.percentage} />
                <span className="font-medium text-muted-foreground text-xs tabular-nums">{row.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex justify-between gap-1 text-muted-foreground text-xs">
          <span>{t("signalsTracked", { count: rows.length })}</span>
          <span>·</span>
          <span>{t("improving", { count: rows.filter((row) => row.isPositive).length })}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

function GymActionItems({ items }: { items: GymActionItem[] }) {
  const t = useTranslations("Dashboard.default.charts");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("actionItems")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={item.checked} readOnly />
                <span className="font-medium text-sm">{item.title}</span>
                <span
                  className={cn(
                    "w-fit rounded-md px-2 py-1 font-medium text-xs",
                    item.priority === "High" && "bg-destructive/20 text-destructive",
                    item.priority === "Medium" && "bg-yellow-500/20 text-yellow-500",
                    item.priority === "Low" && "bg-green-500/20 text-green-500",
                  )}
                >
                  {item.priorityLabel}
                </span>
              </div>
              <div className="font-medium text-muted-foreground text-xs">{item.description}</div>
              <div className="flex items-center gap-1">
                <Clock className="size-3 text-muted-foreground" />
                <span className="font-medium text-muted-foreground text-xs">{item.due}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const crmMiniBarConfig = {
  orders: {
    label: "Orders",
    color: "var(--chart-1)",
  },
  units: {
    label: "Units",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const crmAreaConfig = {
  sales: {
    label: "Orders",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const crmRevenueConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const financeCashFlowConfig = {
  income: {
    label: "Income",
    color: "var(--chart-1)",
  },
  costBasis: {
    label: "Activity basis",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const gymBreakdownConfig = {
  value: {
    label: "Total",
  },
  active: {
    label: "Active Subs",
    color: "var(--chart-1)",
  },
  newMembers: {
    label: "New Members",
    color: "var(--chart-2)",
  },
  sales: {
    label: "Sales",
    color: "var(--chart-3)",
  },
  units: {
    label: "Units",
    color: "var(--chart-4)",
  },
  expiring: {
    label: "Expiring",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const revenueTargetConfig = {
  actual: {
    label: "Actual",
    color: "var(--chart-1)",
  },
  remaining: {
    label: "Remaining",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const membershipFunnelConfig = {
  value: {
    label: "Count",
    color: "var(--chart-1)",
  },
  stage: {
    label: "Stage",
  },
} satisfies ChartConfig;

type GymBreakdownRow = {
  fill: string;
  label: string;
  source: keyof typeof gymBreakdownConfig;
  value: number;
};

type RevenueTargetRow = {
  actual: number;
  name: string;
  progress: number;
  remaining: number;
  target: number;
};

type FunnelRow = {
  fill: string;
  stage: string;
  value: number;
};

type SourceBreakdownRow = {
  amount: number;
  growth: string;
  isPositive: boolean;
  name: string;
  percentage: number;
};

type GymActionItem = {
  checked: boolean;
  description: string;
  due: string;
  id: string;
  priority: "High" | "Medium" | "Low";
  priorityLabel: string;
  title: string;
};

type ChartTranslator = ReturnType<typeof useTranslations>;

function isChartStyle(value: string | null): value is ChartStyle {
  return value === "default" || value === "crm-v1" || value === "finance-v1";
}

function getChartStyleLabel(value: ChartStyle, t: ChartTranslator) {
  if (value === "default") {
    return t("defaultStyle");
  }

  if (value === "crm-v1") {
    return t("crmStyle");
  }

  return t("financeStyle");
}

function toCompactBarData(data: SalesChartPoint[]) {
  const chunkSize = Math.max(1, Math.ceil(data.length / 6));

  return Array.from({ length: 6 }, (_, index) => {
    const chunk = data.slice(index * chunkSize, (index + 1) * chunkSize);

    return {
      label: `${index + 1}`,
      orders: chunk.reduce((sum, item) => sum + item.sales, 0),
      units: chunk.reduce((sum, item) => sum + item.units, 0),
    };
  });
}

function toMonthlyRevenueData(data: SalesChartPoint[], locale: string) {
  const monthly = new Map<string, { month: string; revenue: number }>();

  for (const item of data) {
    const month = item.date.slice(0, 7);
    const current = monthly.get(month) ?? { month: formatMonth(item.date, locale), revenue: 0 };

    current.revenue += item.revenue;
    monthly.set(month, current);
  }

  return Array.from(monthly.values()).slice(-12);
}

function toMonthlyCashFlowData(data: SalesChartPoint[], locale: string) {
  return toMonthlyRevenueData(data, locale).map((item) => ({
    month: item.month,
    income: item.revenue,
    costBasis: -Math.round(item.revenue * 0.34),
  }));
}

function toGymBreakdown(
  summary: DashboardSummary,
  totals: ReturnType<typeof getTotals>,
  t: ChartTranslator,
): GymBreakdownRow[] {
  const rows: GymBreakdownRow[] = [
    {
      fill: "var(--color-active)",
      label: t("activeSubs"),
      source: "active",
      value: Math.max(0, summary.active_subscriptions),
    },
    {
      fill: "var(--color-newMembers)",
      label: t("newMembers"),
      source: "newMembers",
      value: Math.max(0, summary.new_members_this_month ?? 0),
    },
    {
      fill: "var(--color-sales)",
      label: t("sales"),
      source: "sales",
      value: Math.max(0, totals.sales),
    },
    {
      fill: "var(--color-units)",
      label: t("units"),
      source: "units",
      value: Math.max(0, totals.units),
    },
    {
      fill: "var(--color-expiring)",
      label: t("expiring"),
      source: "expiring",
      value: Math.max(0, summary.expiring_soon),
    },
  ];

  return rows.filter((row) => row.value > 0);
}

function toRevenueTargetRows(
  data: SalesChartPoint[],
  totals: ReturnType<typeof getTotals>,
  locale: string,
): RevenueTargetRow[] {
  const monthly = toMonthlyRevenueData(data, locale).slice(-6);
  const fallbackTarget = Math.max(1, Math.round(totals.revenue / Math.max(monthly.length, 1)));

  return monthly.map((row) => {
    const target = Math.max(fallbackTarget, Math.round(row.revenue * 1.16), 1);

    return {
      actual: Math.round(row.revenue),
      name: row.month,
      progress: Math.round((row.revenue / target) * 100),
      remaining: Math.max(0, target - Math.round(row.revenue)),
      target,
    };
  });
}

function toMembershipFunnel(
  summary: DashboardSummary,
  totals: ReturnType<typeof getTotals>,
  t: ChartTranslator,
): FunnelRow[] {
  const active = Math.max(summary.active_subscriptions, 1);
  const sales = Math.max(totals.sales, 0);
  const newMembers = Math.max(summary.new_members_this_month ?? 0, 0);
  const expiring = Math.max(summary.expiring_soon, 0);
  const soldUnits = Math.max(totals.units, 0);

  return [
    { fill: "var(--chart-1)", stage: t("activeSubs"), value: active },
    { fill: "var(--chart-2)", stage: t("sales"), value: Math.min(active, sales || active) },
    { fill: "var(--chart-3)", stage: t("units"), value: Math.min(active, soldUnits || Math.ceil(active * 0.7)) },
    { fill: "var(--chart-4)", stage: t("newMembers"), value: Math.min(active, newMembers || Math.ceil(active * 0.35)) },
    { fill: "var(--chart-5)", stage: t("renewalRisk"), value: Math.min(active, expiring || Math.ceil(active * 0.15)) },
  ];
}

function toGymSourceRows(
  summary: DashboardSummary,
  totals: ReturnType<typeof getTotals>,
  t: ChartTranslator,
): SourceBreakdownRow[] {
  const total = Math.max(totals.revenue, Number(summary.revenue_mtd), 1);
  const revenueGrowth = Number(summary.revenue_growth_rate ?? 0);
  const memberGrowth = Number(summary.new_members_growth_rate ?? 0);
  const posRevenue = Number(summary.sales_today.revenue);
  const activeValue = Math.round(total * 0.42);
  const posValue = Math.max(posRevenue, Math.round(total * 0.22));
  const newMemberValue = Math.round(total * 0.18);
  const expiringValue = Math.round(total * 0.1);
  const unitsValue = Math.max(0, total - activeValue - posValue - newMemberValue - expiringValue);

  return [
    {
      amount: activeValue,
      growth: formatSignedPercent(revenueGrowth),
      isPositive: revenueGrowth >= 0,
      name: t("memberships"),
      percentage: percentage(activeValue, total),
    },
    {
      amount: posValue,
      growth: formatSignedPercent(revenueGrowth / 2),
      isPositive: revenueGrowth >= 0,
      name: t("gymPos"),
      percentage: percentage(posValue, total),
    },
    {
      amount: newMemberValue,
      growth: formatSignedPercent(memberGrowth),
      isPositive: memberGrowth >= 0,
      name: t("newMembers"),
      percentage: percentage(newMemberValue, total),
    },
    {
      amount: expiringValue,
      growth: summary.expiring_soon > 0 ? `- ${t("risk")}` : `+ ${t("clear")}`,
      isPositive: summary.expiring_soon === 0,
      name: t("renewals"),
      percentage: percentage(expiringValue, total),
    },
    {
      amount: unitsValue,
      growth: `+ ${t("live")}`,
      isPositive: true,
      name: t("products"),
      percentage: percentage(unitsValue, total),
    },
  ];
}

function toGymActionItems(summary: DashboardSummary, t: ChartTranslator): GymActionItem[] {
  const dueToday = summary.sales_today.count;
  const renewalPriority = getRenewalPriority(summary.expiring_soon);

  return [
    {
      checked: summary.expiring_soon === 0,
      description: t("subscriptionsCloseToExpiry", { count: summary.expiring_soon }),
      due: summary.expiring_soon > 0 ? t("dueToday") : t("noUrgentRenewals"),
      id: "renewals",
      priority: renewalPriority,
      priorityLabel: priorityLabel(renewalPriority, t),
      title: t("renewalFollowUps"),
    },
    {
      checked: dueToday > 0,
      description: t("posTransactionsToday", { count: dueToday }),
      due: dueToday > 0 ? t("updatedToday") : t("waitingForSales"),
      id: "sales",
      priority: dueToday > 0 ? "Low" : "Medium",
      priorityLabel: priorityLabel(dueToday > 0 ? "Low" : "Medium", t),
      title: t("reviewTodaySales"),
    },
    {
      checked: Number(summary.revenue_growth_rate ?? 0) >= 0,
      description: t("revenueGrowthIs", { value: formatSignedPercent(Number(summary.revenue_growth_rate ?? 0)) }),
      due: t("thisMonth"),
      id: "growth",
      priority: Number(summary.revenue_growth_rate ?? 0) < 0 ? "High" : "Low",
      priorityLabel: priorityLabel(Number(summary.revenue_growth_rate ?? 0) < 0 ? "High" : "Low", t),
      title: t("revenueTrend"),
    },
  ];
}

function getRenewalPriority(expiringSoon: number): GymActionItem["priority"] {
  if (expiringSoon > 10) {
    return "High";
  }

  if (expiringSoon > 0) {
    return "Medium";
  }

  return "Low";
}

function priorityLabel(priority: GymActionItem["priority"], t: ChartTranslator) {
  if (priority === "High") {
    return t("priorityHigh");
  }

  if (priority === "Medium") {
    return t("priorityMedium");
  }

  return t("priorityLow");
}

function getTotals(data: SalesChartPoint[]) {
  return data.reduce(
    (totals, item) => ({
      revenue: totals.revenue + item.revenue,
      sales: totals.sales + item.sales,
      units: totals.units + item.units,
    }),
    { revenue: 0, sales: 0, units: 0 },
  );
}

function TrendPill({ value }: { value: number }) {
  const isDown = value < 0;
  const sign = value > 0 ? "+" : "";

  return (
    <span
      className={
        isDown
          ? "w-fit rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive text-xs"
          : "w-fit rounded-md bg-green-500/10 px-2 py-1 font-medium text-green-500 text-xs"
      }
    >
      {sign}
      {value.toFixed(1)}%
    </span>
  );
}

function formatMonth(value: string, locale: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

function formatTooltipDate(value: ReactNode, locale: string) {
  if (typeof value !== "string") {
    return String(value);
  }

  const date = parseISO(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
}

function formatCompactAxis(value: number) {
  const abs = Math.abs(value);
  const formatted = abs >= 1000 ? `${Math.round(abs / 1000)}k` : `${abs}`;

  return value < 0 ? `-${formatted}` : formatted;
}

function percentage(value: number, total: number) {
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}
