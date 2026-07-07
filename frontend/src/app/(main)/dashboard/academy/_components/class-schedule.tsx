import Link from "next/link";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { StaffAcademyShift } from "./data";
import { formatTimeRange12Hour } from "./time-format";

function statusClass(status: StaffAcademyShift["status"]) {
  if (status === "in_progress") {
    return "border-green-600/50 bg-green-50 text-green-600 dark:border-green-800/50 dark:bg-green-500/10 dark:text-green-400";
  }

  if (status === "upcoming") {
    return "border-yellow-600/50 bg-yellow-50 text-yellow-700 dark:border-yellow-800/50 dark:bg-yellow-500/10 dark:text-yellow-300";
  }

  return "border-muted-foreground/30 bg-muted text-muted-foreground";
}

function statusBarClass(status: StaffAcademyShift["status"]) {
  if (status === "in_progress") return "bg-green-600 dark:bg-green-400";
  if (status === "upcoming") return "bg-yellow-500 dark:bg-yellow-400";

  return "bg-muted-foreground";
}

export function ClassSchedule({ shifts }: { shifts: StaffAcademyShift[] }) {
  const t = useTranslations("Dashboard.academy");
  const locale = useLocale();
  const today = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", weekday: "long" }).format(new Date());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("staffShiftSchedule")}</CardTitle>
        <CardAction>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          >
            {t("shiftSettings")} <ArrowRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {shifts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            {t("noShifts")}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {shifts.map((shift) => (
              <div
                className="grid grid-cols-1 gap-3 bg-card py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[10rem_1fr_auto] sm:items-center"
                key={shift.id}
              >
                <div className="flex gap-2">
                  <div className={`w-1 shrink-0 rounded-md ${statusBarClass(shift.status)}`} />
                  <div className="text-nowrap text-xs">
                    <div className="font-medium text-foreground">{formatTimeRange12Hour(shift.time, locale)}</div>
                    <div className="text-muted-foreground">{today}</div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                  <div className="truncate font-medium text-foreground text-sm leading-none">{shift.name}</div>
                  <div className="truncate text-muted-foreground text-xs leading-none">
                    {t("assignedGrace", { minutes: shift.grace_minutes, staff: shift.staff_count })}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {shift.staff_names.length > 0 ? (
                      shift.staff_names.map((name) => (
                        <Badge
                          className="max-w-full truncate rounded-md px-2 py-0.5 font-normal text-[10px]"
                          key={`${shift.id}-${name}`}
                          variant="outline"
                        >
                          {name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">{t("noAssignedStaff")}</span>
                    )}
                  </div>
                </div>

                <Badge
                  variant="secondary"
                  className={`shrink-0 rounded-md px-2.5 py-1 font-medium text-[10px] ${statusClass(shift.status)}`}
                >
                  {t(`statuses.${shift.status}`)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
