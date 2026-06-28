import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { MembershipSummary } from "./data";

export function KpiCards({ summary }: { summary: MembershipSummary }) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl tracking-tight">Membership Pipeline</h2>
        <p className="text-muted-foreground text-sm">
          Track active subscriptions, renewal follow-ups, member growth, and balances that need attention.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Subscription Revenue</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight">
                {formatCurrency(summary.subscriptionRevenue, { currency: "EGP", maximumFractionDigits: 0 })}
              </span>

              <PositiveBadge
                value={`${formatCurrency(summary.salesTodayRevenue, { currency: "EGP", noDecimals: true })} today`}
              />
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">All subscription value</span>{" "}
              <span className="text-muted-foreground">currently tracked</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Outstanding Dues</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight">
                {formatCurrency(summary.outstandingDuesTotal, { currency: "EGP", maximumFractionDigits: 0 })}
              </span>

              <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                <TrendingDown />
                {summary.outstandingDuesCount} due
              </Badge>
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">Unpaid balances</span>{" "}
              <span className="text-muted-foreground">from subscriptions</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Renewal Follow-ups</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight">{summary.expiringSoon}</span>

              <PositiveBadge value="soon" />
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">Active subscriptions</span>{" "}
              <span className="text-muted-foreground">near expiry</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>New Members</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight">{summary.newMembersThisMonth}</span>

              <PositiveBadge value={`${formatPercent(summary.memberGrowthRate)}`} />
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">{summary.activeSubscriptions}</span>{" "}
              <span className="text-muted-foreground">active subscriptions</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function PositiveBadge({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className="border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
    >
      <TrendingUp />
      {value}
    </Badge>
  );
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}
