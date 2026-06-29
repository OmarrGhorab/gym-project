import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { StaffAcademyShift } from "./data";

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

function statusLabel(status: StaffAcademyShift["status"]) {
  if (status === "in_progress") return "In Progress";
  if (status === "upcoming") return "Upcoming";

  return "Completed";
}

export function ClassSchedule({ shifts }: { shifts: StaffAcademyShift[] }) {
  const today = format(new Date(), "EEEE, d MMMM");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Staff Shift Schedule</CardTitle>
        <CardAction className="flex items-center gap-1 text-muted-foreground text-xs">
          Shift Settings <ArrowRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {shifts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            No active staff shifts configured yet.
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
                    <div className="font-medium text-foreground">{shift.time}</div>
                    <div className="text-muted-foreground">{today}</div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                  <div className="truncate font-medium text-foreground text-sm leading-none">{shift.name}</div>
                  <div className="truncate text-muted-foreground text-xs leading-none">
                    {shift.staff_count} assigned staff • {shift.grace_minutes} min grace
                  </div>
                </div>

                <Badge
                  variant="secondary"
                  className={`shrink-0 rounded-md px-2.5 py-1 font-medium text-[10px] ${statusClass(shift.status)}`}
                >
                  {statusLabel(shift.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
