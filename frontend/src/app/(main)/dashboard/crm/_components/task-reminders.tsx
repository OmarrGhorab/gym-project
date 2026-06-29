import { CalendarRange } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

import type { RenewalFollowUp } from "./data";

const renewalGoalBarCount = 42;

export function TaskReminders({
  followUps,
  renewalGoal,
}: {
  followUps: RenewalFollowUp[];
  renewalGoal: { expiringSoon: number; target: number; percentage: number };
}) {
  const t = useTranslations("Dashboard.crm");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const activeRenewalBars = Math.round((renewalGoal.percentage / 100) * renewalGoalBarCount);
  const renewalGoalBars = Array.from({ length: renewalGoalBarCount }, (_, index) => ({
    id: `renewal-goal-${index + 1}`,
    active: index < activeRenewalBars,
  }));

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader>
          <CardTitle>{t("renewalFollowUps")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {followUps.length > 0 ? (
              followUps.map((followUp) => (
                <div key={followUp.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CalendarRange className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{followUp.memberName}</div>
                    <div className="truncate text-muted-foreground text-xs">
                      {t("planEndsIn", { plan: followUp.planName, days: numberFormatter.format(followUp.daysLeft) })}
                    </div>
                  </div>
                  <div className="text-end text-sm tabular-nums">
                    {formatCurrency(followUp.amount, { currency: "EGP", noDecimals: true })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm md:col-span-2">
                {t("noRenewals")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-4">
        <CardHeader>
          <CardTitle>{t("renewalAttention")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex items-end justify-between gap-3">
            <div className="font-medium text-2xl tabular-nums leading-none">
              {numberFormatter.format(renewalGoal.expiringSoon)}{" "}
              <span className="font-normal text-base text-muted-foreground">{t("soon")}</span>
            </div>
            <div className="text-muted-foreground text-sm tabular-nums">
              {t("active", { count: numberFormatter.format(renewalGoal.target) })}
            </div>
          </div>
          <div className="flex h-10 w-full items-end gap-0.5">
            {renewalGoalBars.map((bar) => (
              <div key={bar.id} className="flex flex-1 justify-center">
                <div
                  className={cn(
                    "h-10 w-1.5 rounded-full",
                    bar.active ? "bg-muted-foreground/75" : "bg-muted-foreground/25",
                  )}
                />
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {t("renewalAttentionDescription", { percentage: numberFormatter.format(renewalGoal.percentage) })}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
