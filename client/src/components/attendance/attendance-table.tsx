"use client";

import * as React from "react";
import { Edit3, Loader2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { AppLocale } from "@/i18n/routing";
import { deleteAttendance } from "@/lib/actions/attendance";
import type { Attendance } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function AttendanceTable({
  attendance,
  onEdit,
}: {
  attendance: Attendance[];
  onEdit: (attendance: Attendance) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Attendance>[]>(
    () => [
      {
        accessorKey: "employee",
        header: t("tableEmployee"),
        cell: ({ row }) => (
          <div className={cn("min-w-48", isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              {row.original.employee?.name ?? t("unknownEmployee")}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              #{row.original.employee_id} · {row.original.employee?.role ?? "-"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "date",
        header: t("tableDate"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.date, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("tableStatus"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "check_in",
        header: t("tableCheckIn"),
        cell: ({ row }) => <Time value={row.original.check_in} />,
      },
      {
        accessorKey: "check_out",
        header: t("tableCheckOut"),
        cell: ({ row }) => <Time value={row.original.check_out} />,
      },
      {
        accessorKey: "schedule_status",
        header: t("tableSchedule"),
        cell: ({ row }) => (
          <div className="space-y-1">
            <Badge variant="outline" className="rounded-md text-xs font-bold">
              {scheduleStatusLabel(row.original.schedule_status, t)}
            </Badge>
            <p className="text-xs font-semibold text-muted-foreground">
              {approvalStatusLabel(row.original.approval_status, t)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "late_minutes",
        header: t("tableLateMinutes"),
        cell: ({ row }) => (
          <span className="text-xs font-black text-foreground tabular-nums">
            {t("minutesShort", { count: row.original.late_minutes ?? 0 })}
          </span>
        ),
      },
      {
        accessorKey: "check_in_location",
        header: t("tableLocation"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("rounded-md text-xs font-bold", locationClass(row.original.check_in_location?.status))}>
            {locationStatusLabel(row.original.check_in_location?.status, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "notes",
        header: t("tableNotes"),
        cell: ({ row }) => (
          <p className="line-clamp-2 min-w-48 text-xs font-semibold text-muted-foreground">
            {row.original.notes || t("noNotes")}
          </p>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableActions")}
          </span>
        ),
        cell: ({ row }) => (
          <AttendanceActions attendance={row.original} onEdit={onEdit} />
        ),
      },
    ],
    [dateLocale, isArabic, onEdit, t]
  );

  return (
    <DataTable
      columns={columns}
      data={attendance}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function AttendanceActions({
  attendance,
  onEdit,
}: {
  attendance: Attendance;
  onEdit: (attendance: Attendance) => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const [isPending, setIsPending] = React.useState(false);

  async function handleDelete() {
    const name = attendance.employee?.name ?? `#${attendance.employee_id}`;
    const confirmed = window.confirm(t("deleteConfirm", { name }));
    if (!confirmed) return;

    setIsPending(true);
    try {
      await deleteAttendance(attendance.id, locale as AppLocale);
      toast.success(t("attendanceDeletedSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionEdit")} onClick={() => onEdit(attendance)}>
        <Edit3 className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionDelete")} onClick={handleDelete} disabled={isPending}>
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </Button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("AttendancePage");
  const labelMap: Record<string, string> = {
    present: t("statusPresent"),
    late: t("statusLate"),
    absent: t("statusAbsent"),
    excused: t("statusExcused"),
  };
  const classNameMap: Record<string, string> = {
    present: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    late: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    absent: "border-destructive/30 bg-destructive/10 text-destructive",
    excused: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };

  return (
    <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-xs font-bold", classNameMap[status])}>
      {labelMap[status] ?? status}
    </Badge>
  );
}

function Time({ value }: { value?: string | null }) {
  return (
    <span className="text-sm font-black text-foreground tabular-nums">
      {value || "-"}
    </span>
  );
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function scheduleStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case "on_shift":
      return t("scheduleOnShift");
    case "late":
      return t("scheduleLate");
    case "off_shift":
      return t("scheduleOffShift");
    case "unassigned":
      return t("scheduleUnassigned");
    default:
      return status ?? t("scheduleUnknown");
  }
}

function approvalStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case "pending":
      return t("approvalPending");
    case "approved":
      return t("approvalApproved");
    case "dismissed":
      return t("approvalDismissed");
    default:
      return status ?? t("approvalUnknown");
  }
}

function locationStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case "inside":
      return t("locationInside");
    case "outside":
      return t("locationOutside");
    case "unconfigured":
      return t("locationUnconfigured");
    default:
      return t("locationMissingShort");
  }
}

function locationClass(status: string | null | undefined) {
  switch (status) {
    case "inside":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "outside":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-slate-500/20 bg-slate-500/10 text-muted-foreground";
  }
}
