import { DollarSign, TrendingDown, TrendingUp, UserPlus, Users, Waves } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MoneyOnly } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { DashboardSummary } from "./data";

type MetricCardsProps = {
  canViewMembers: boolean;
  canViewReports: boolean;
  summary: DashboardSummary;
};

export function MetricCards({ canViewMembers, canViewReports, summary }: MetricCardsProps) {
  const t = useTranslations("Dashboard.default.metrics");
  const locale = useLocale();
  const revenueGrowth = Number(summary.revenue_growth_rate ?? 0);
  const memberGrowth = Number(summary.new_members_growth_rate ?? 0);
  const numberFormatter = new Intl.NumberFormat(locale);

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {canViewReports ? (
        // The tile holds nothing but the revenue figure, so it drops out whole
        // rather than sitting there with a dash where the number was.
        <MoneyOnly domain="dashboard">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <DollarSign className="size-4" />
                </div>
              </CardTitle>
              <CardDescription>{t("totalRevenue")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
                  {formatCurrency(Number(summary.revenue_mtd), { currency: "EGP", maximumFractionDigits: 0 })}
                </div>
                <TrendBadge value={revenueGrowth} />
              </div>
              <p className="text-muted-foreground text-sm">{t("totalRevenueHelp")}</p>
            </CardContent>
          </Card>
        </MoneyOnly>
      ) : null}

      {canViewMembers ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <UserPlus className="size-4" />
              </div>
            </CardTitle>
            <CardDescription>{t("newCustomers")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
                {numberFormatter.format(summary.new_members_this_month ?? 0)}
              </div>
              <TrendBadge value={memberGrowth} />
            </div>
            <p className="text-muted-foreground text-sm">{t("newCustomersHelp")}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Users className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>{t("activeAccounts")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {numberFormatter.format(summary.active_subscriptions)}
            </div>
            <Badge variant="secondary">{t("live")}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{t("activeAccountsHelp")}</p>
        </CardContent>
      </Card>

      {canViewMembers ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <Waves className="size-4" />
              </div>
            </CardTitle>
            <CardDescription>{t("growthRate")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
                {formatPercent(memberGrowth)}
              </div>
              <TrendBadge value={memberGrowth} />
            </div>
            <p className="text-muted-foreground text-sm">{t("growthRateHelp")}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  const isDown = value < 0;
  const Icon = isDown ? TrendingDown : TrendingUp;

  return (
    <Badge variant={isDown ? "destructive" : "default"}>
      <Icon className="size-3" />
      {formatPercent(value)}
    </Badge>
  );
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}
