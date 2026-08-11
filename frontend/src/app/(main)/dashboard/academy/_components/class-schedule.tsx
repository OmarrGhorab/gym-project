import Link from "next/link";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GYM_TIME_ZONE } from "@/lib/timezone";

import type { StaffAcademyShift } from "./data";

export function ClassSchedule({ shifts }: { shifts: StaffAcademyShift[] }) {
  const t = useTranslations("Dashboard.academy");
  const locale = useLocale();
  const today = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: GYM_TIME_ZONE,
    weekday: "long",
  }).format(new Date());

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
          <>
            <p className="pb-3 text-muted-foreground text-xs">{today}</p>
            <div className="flex flex-col divide-y divide-border">
              {shifts.map((shift) => (
                <div
                  className="grid grid-cols-1 gap-3 bg-card py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[1fr_auto] sm:items-center"
                  key={shift.id}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="truncate font-medium text-foreground text-sm leading-none">{shift.name}</div>
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

                  <Badge variant="secondary" className="shrink-0 rounded-md px-2.5 py-1 font-medium text-[10px]">
                    {t("assignedStaffCount", { staff: shift.staff_count })}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
