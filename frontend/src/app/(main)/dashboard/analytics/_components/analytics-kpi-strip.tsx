import { AlertTriangle, Clock3, DoorOpen, ShieldAlert, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { LiveAttendanceData } from "./data";

const cards = [
  {
    icon: DoorOpen,
    key: "inside",
    title: "Currently inside",
  },
  {
    icon: UserCheck,
    key: "visits",
    title: "Member visits",
  },
  {
    icon: Clock3,
    key: "staff",
    title: "Staff check-ins",
  },
  {
    icon: ShieldAlert,
    key: "risk",
    title: "Flagged or blocked",
  },
  {
    icon: AlertTriangle,
    key: "late",
    title: "Late staff",
  },
] as const;

export function AnalyticsKpiStrip({ data }: { data: LiveAttendanceData }) {
  const values = {
    inside: {
      detail: `${data.currently_inside.members} members / ${data.currently_inside.staff} staff`,
      value: data.currently_inside.total,
    },
    visits: {
      detail: "Total member entries today",
      value: data.today.member_visits,
    },
    staff: {
      detail: "Employee and captain scans",
      value: data.today.staff_checkins,
    },
    risk: {
      detail: `${data.today.flagged_scans} flagged / ${data.today.blocked_visits} blocked`,
      value: data.today.flagged_scans + data.today.blocked_visits,
    },
    late: {
      detail: data.today.peak_hour ? `Peak occupancy at ${data.today.peak_hour}` : "No peak hour yet",
      value: data.today.late_staff,
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
                <CardTitle className="font-normal text-sm">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-2xl tabular-nums leading-none tracking-tight">{metric.value}</div>
                  <Badge
                    className={
                      risky && metric.value > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                    }
                  >
                    <Icon />
                    Live
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
