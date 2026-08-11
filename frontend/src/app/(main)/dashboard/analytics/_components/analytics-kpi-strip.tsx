import { AlertTriangle, Clock3, DoorOpen, ShieldAlert, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { LiveAttendanceData } from "./data";

const cards = [
  {
    icon: DoorOpen,
    key: "inside",
    titleKey: "currentlyInside",
  },
  {
    icon: UserCheck,
    key: "visits",
    titleKey: "memberVisits",
  },
  {
    icon: Clock3,
    key: "staff",
    titleKey: "staffCheckins",
  },
  {
    icon: ShieldAlert,
    key: "risk",
    titleKey: "flaggedOrBlocked",
  },
  {
    icon: AlertTriangle,
    key: "late",
    titleKey: "lateStaff",
  },
] as const;

export function AnalyticsKpiStrip({ data }: { data: LiveAttendanceData }) {
  const t = useTranslations("Dashboard.analytics");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const values = {
    inside: {
      detail: t("insideDetail", {
        members: numberFormatter.format(data.currently_inside.members),
        staff: numberFormatter.format(data.currently_inside.staff),
      }),
      value: data.currently_inside.total,
    },
    visits: {
      detail: t("totalMemberEntries"),
      value: data.today.member_visits,
    },
    staff: {
      detail: t("staffScanDetail"),
      value: data.today.staff_checkins,
    },
    risk: {
      detail: t("riskDetail", {
        blocked: numberFormatter.format(data.today.blocked_visits),
        flagged: numberFormatter.format(data.today.flagged_scans),
      }),
      value: data.today.flagged_scans + data.today.blocked_visits,
    },
    late: {
      detail: data.today.peak_hour ? t("peakOccupancy", { time: data.today.peak_hour }) : t("noPeakHour"),
      value: data.today.staff_still_in,
    },
  };

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="grid divide-y *:data-[slot=card]:rounded-none *:data-[slot=card]:ring-0 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const metric = values[card.key];
          const risky = card.key === "risk" || card.key === "late";

          return (
            <Card key={card.key}>
              <CardHeader>
                <CardTitle className="font-normal text-sm">{t(card.titleKey)}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-2xl tabular-nums leading-none tracking-tight">
                    {numberFormatter.format(metric.value)}
                  </div>
                  <Badge
                    className={
                      risky && metric.value > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                    }
                  >
                    <Icon />
                    {t("live")}
                  </Badge>
                </div>

                <div className="text-muted-foreground text-xs">{metric.detail}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
