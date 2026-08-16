import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { MembershipSummary } from "./data";

export function KpiCards({ canViewMoney, summary }: { canViewMoney: boolean; summary: MembershipSummary }) {
  const t = useTranslations("Dashboard.crm");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {canViewMoney ? (
          <Card>
            <CardHeader>
              <CardDescription>{t("subscriptionRevenue")}</CardDescription>
              <CardAction>
                <ArrowUpRight className="size-4" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <Money domain="subscriptions" className="text-3xl leading-none tracking-tight">
                  {formatCurrency(summary.subscriptionRevenue, { currency: "EGP", maximumFractionDigits: 0 })}
                </Money>

                <Money domain="sales">
                  <PositiveBadge
                    value={t("today", {
                      value: formatCurrency(summary.salesTodayRevenue, { currency: "EGP", noDecimals: true }),
                    })}
                  />
                </Money>
              </div>
              <p className="text-sm">
                <span className="font-medium text-foreground">{t("allSubscriptionValue")}</span>{" "}
                <span className="text-muted-foreground">{t("currentlyTracked")}</span>
              </p>
            </CardContent>
          </Card>
        ) : null}

        {canViewMoney ? (
          <Card>
            <CardHeader>
              <CardDescription>{t("outstandingDues")}</CardDescription>
              <CardAction>
                <ArrowUpRight className="size-4" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <Money domain="payments" className="text-3xl leading-none tracking-tight">
                  {formatCurrency(summary.outstandingDuesTotal, { currency: "EGP", maximumFractionDigits: 0 })}
                </Money>

                <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                  <TrendingDown />
                  {t("dueCount", { count: numberFormatter.format(summary.outstandingDuesCount) })}
                </Badge>
              </div>
              <p className="text-sm">
                <span className="font-medium text-foreground">{t("unpaidBalances")}</span>{" "}
                <span className="text-muted-foreground">{t("fromSubscriptions")}</span>
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardDescription>{t("renewalFollowUps")}</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight">
                {numberFormatter.format(summary.expiringSoon)}
              </span>

              <PositiveBadge value={t("soon")} />
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">{t("activeSubscriptions")}</span>{" "}
              <span className="text-muted-foreground">{t("nearExpiry")}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("newMembers")}</CardDescription>
            <CardAction>
              <ArrowUpRight className="size-4" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none tracking-tight">
                {numberFormatter.format(summary.newMembersThisMonth)}
              </span>

              <PositiveBadge value={`${formatPercent(summary.memberGrowthRate)}`} />
            </div>
            <p className="text-sm">
              <span className="font-medium text-foreground">{numberFormatter.format(summary.activeSubscriptions)}</span>{" "}
              <span className="text-muted-foreground">{t("activeSubscriptions")}</span>
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
