"use client";

import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { FinanceDashboardData } from "./data";

export function OverviewKpis({ totals }: { totals: FinanceDashboardData["totals"] }) {
  const t = useTranslations("Dashboard.finance");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const revenue = Number(totals.revenue_mtd);
  const previousRevenue = Number(totals.previous_revenue_mtd);
  const expenses = Number(totals.expenses_mtd);
  const previousExpenses = Number(totals.previous_expenses_mtd);
  const netProfit = Number(totals.net_profit_mtd);
  const margin = Number(totals.profit_margin);

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="grid grid-cols-1 xl:grid-cols-8">
        <Card className="gap-5 overflow-hidden rounded-none border-0 border-foreground/10 border-b ring-0 xl:col-span-4 xl:border-r">
          <CardHeader>
            <CardTitle className="font-normal">{t("netProfit")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="space-y-1">
              <div className="font-heading text-3xl leading-none tracking-tight">
                {formatCurrency(netProfit, { currency: "EGP", noDecimals: true })}
              </div>
              <p className="text-muted-foreground text-xs">{t("netProfitDescription")}</p>
            </div>
            <GrowthBadge value={netProfit >= 0 ? margin : -Math.abs(margin)} suffix={t("margin")} />
          </CardContent>
        </Card>

        <Card className="gap-5 overflow-hidden rounded-none border-0 border-foreground/10 border-b ring-0 xl:col-span-4">
          <CardHeader>
            <CardTitle className="font-normal">{t("collectedRevenue")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <div className="font-heading text-3xl leading-none tracking-tight">
                {formatCurrency(revenue, { currency: "EGP", noDecimals: true })}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("vsPreviousMonth", { value: formatDelta(revenue - previousRevenue, t) })}
              </p>
            </div>
            <GrowthBadge value={Number(totals.revenue_growth_rate)} />
          </CardContent>
        </Card>

        <Card className="gap-5 overflow-hidden rounded-none border-0 border-foreground/10 ring-0 xl:col-span-4 xl:border-r">
          <CardHeader>
            <CardTitle className="font-normal">{t("operatingExpenses")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <div className="font-heading text-3xl leading-none tracking-tight">
                {formatCurrency(expenses, { currency: "EGP", noDecimals: true })}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("vsPreviousMonth", { value: formatDelta(expenses - previousExpenses, t) })}
              </p>
            </div>
            <GrowthBadge value={Number(totals.expense_growth_rate)} inverse />
          </CardContent>
        </Card>

        <Card className="gap-5 overflow-hidden rounded-none border-0 ring-0 xl:col-span-4">
          <CardHeader>
            <CardTitle className="font-normal">{t("pendingPayroll")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <div className="font-heading text-3xl leading-none tracking-tight">
                {formatCurrency(Number(totals.pending_payroll), { currency: "EGP", noDecimals: true })}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("duesToCollect", {
                  value: formatCurrency(Number(totals.outstanding_dues), { currency: "EGP", noDecimals: true }),
                })}
              </p>
            </div>
            <Badge className="bg-chart-2/10 text-chart-2">
              {t("dueCount", { count: numberFormatter.format(totals.outstanding_dues_count) })}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GrowthBadge({ value, inverse = false, suffix = "%" }: { value: number; inverse?: boolean; suffix?: string }) {
  const good = inverse ? value <= 0 : value >= 0;
  const sign = value > 0 ? "+" : "";

  return (
    <Badge
      className={good ? "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300" : undefined}
      variant={good ? "default" : "destructive"}
    >
      {sign}
      {value.toFixed(1)}
      {suffix}
    </Badge>
  );
}

function formatDelta(value: number, t: ReturnType<typeof useTranslations>) {
  const formatted = formatCurrency(Math.abs(value), { currency: "EGP", noDecimals: true });

  if (value === 0) {
    return t("noChange");
  }

  return `${value > 0 ? "+" : "-"}${formatted}`;
}
