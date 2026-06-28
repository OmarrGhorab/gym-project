import { DollarSign, TrendingDown, TrendingUp, UserPlus, Users, Waves } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { DashboardSummary } from "./data";

type MetricCardsProps = {
  summary: DashboardSummary;
};

export function MetricCards({ summary }: MetricCardsProps) {
  const revenueGrowth = Number(summary.revenue_growth_rate ?? 0);
  const memberGrowth = Number(summary.new_members_growth_rate ?? 0);

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <DollarSign className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Total Revenue</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {formatCurrency(Number(summary.revenue_mtd), { currency: "EGP", maximumFractionDigits: 0 })}
            </div>
            <TrendBadge value={revenueGrowth} />
          </div>
          <p className="text-muted-foreground text-sm">Paid revenue for the current month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <UserPlus className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>New Customers</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {numberFormatter.format(summary.new_members_this_month ?? 0)}
            </div>
            <TrendBadge value={memberGrowth} />
          </div>
          <p className="text-muted-foreground text-sm">Members added this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Users className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Active Accounts</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {numberFormatter.format(summary.active_subscriptions)}
            </div>
            <Badge variant="secondary">Live</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Currently active subscriptions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Waves className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Growth Rate</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {formatPercent(memberGrowth)}
            </div>
            <TrendBadge value={memberGrowth} />
          </div>
          <p className="text-muted-foreground text-sm">New members vs previous month</p>
        </CardContent>
      </Card>
    </div>
  );
}

const numberFormatter = new Intl.NumberFormat("en-US");

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
