"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { AppLocale } from "@/i18n/routing";
import { reviewAttendanceViolation } from "@/lib/actions/attendance";
import type { AttendanceViolation } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function AttendanceViolationsTable({
  violations,
}: {
  violations: AttendanceViolation[];
}) {
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<AttendanceViolation>[]>(
    () => [
      {
        accessorKey: "employee",
        header: t("violationEmployee"),
        cell: ({ row }) => (
          <div className={cn("min-w-44", isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              {row.original.employee?.name ?? `#${row.original.employee_id}`}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.employee?.role ?? "-"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "violation_date",
        header: t("violationDate"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.violation_date, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: t("violationType"),
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-black text-foreground">
              {violationTypeLabel(row.original.type, t)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.minutes ? t("violationMinutes", { count: row.original.minutes }) : row.original.notes ?? "-"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "deduction_days",
        header: t("violationDeduction"),
        cell: ({ row }) => (
          <span className="text-xs font-black text-foreground tabular-nums">
            {t("violationDeductionDays", { count: Number(row.original.deduction_days) })}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("violationStatus"),
        cell: ({ row }) => <ViolationStatus status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableActions")}
          </span>
        ),
        cell: ({ row }) => <ViolationActions violation={row.original} />,
      },
    ],
    [dateLocale, isArabic, t]
  );

  return (
    <DataTable
      columns={columns}
      data={violations}
      emptyMessage={t("violationsEmpty")}
      isArabic={isArabic}
    />
  );
}

function ViolationActions({ violation }: { violation: AttendanceViolation }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const [pendingAction, setPendingAction] = React.useState<"approve" | "dismiss" | null>(null);
  const isLocked = violation.status !== "pending";

  async function review(status: "approved" | "dismissed") {
    setPendingAction(status === "approved" ? "approve" : "dismiss");
    try {
      await reviewAttendanceViolation(
        violation.id,
        { status },
        locale as AppLocale
      );
      toast.success(status === "approved" ? t("violationApproved") : t("violationDismissed"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={t("violationApprove")}
        disabled={isLocked || Boolean(pendingAction)}
        onClick={() => review("approved")}
      >
        {pendingAction === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={t("violationDismiss")}
        disabled={isLocked || Boolean(pendingAction)}
        onClick={() => review("dismissed")}
      >
        {pendingAction === "dismiss" ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
      </Button>
    </div>
  );
}

function ViolationStatus({ status }: { status: string }) {
  const t = useTranslations("AttendancePage");
  const className = status === "pending"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : status === "dismissed"
      ? "border-slate-500/20 bg-slate-500/10 text-muted-foreground"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <Badge variant="outline" className={cn("rounded-md text-xs font-bold", className)}>
      {violationStatusLabel(status, t)}
    </Badge>
  );
}

function violationTypeLabel(type: string, t: (key: string) => string) {
  switch (type) {
    case "late":
      return t("violationTypeLate");
    case "early_leave":
      return t("violationTypeEarlyLeave");
    case "off_shift":
      return t("violationTypeOffShift");
    case "absence":
      return t("violationTypeAbsence");
    default:
      return type;
  }
}

function violationStatusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case "pending":
      return t("violationStatusPending");
    case "approved":
      return t("violationStatusApproved");
    case "dismissed":
      return t("violationStatusDismissed");
    case "auto_applied":
      return t("violationStatusAutoApplied");
    default:
      return status;
  }
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
