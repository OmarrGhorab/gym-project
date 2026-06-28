"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { AttendanceSummary } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function AttendanceSummaryTable({ rows }: { rows: AttendanceSummary[] }) {
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";

  const columns = React.useMemo<ColumnDef<AttendanceSummary>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("summaryEmployee"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">{row.original.name}</p>
            <p className="text-xs font-semibold text-muted-foreground">#{row.original.employee_id} · {row.original.role ?? "-"}</p>
          </div>
        ),
      },
      { accessorKey: "records_count", header: t("summaryRecords"), cell: ({ row }) => <Count value={row.original.records_count} locale={locale} /> },
      { accessorKey: "present_count", header: t("summaryPresent"), cell: ({ row }) => <Count value={row.original.present_count} locale={locale} /> },
      { accessorKey: "late_count", header: t("summaryLate"), cell: ({ row }) => <Count value={row.original.late_count} locale={locale} /> },
      { accessorKey: "absent_count", header: t("summaryAbsent"), cell: ({ row }) => <Count value={row.original.absent_count} locale={locale} /> },
      { accessorKey: "excused_count", header: t("summaryExcused"), cell: ({ row }) => <Count value={row.original.excused_count} locale={locale} /> },
      { accessorKey: "late_minutes", header: t("summaryLateMinutes"), cell: ({ row }) => <Count value={row.original.late_minutes ?? 0} locale={locale} /> },
      { accessorKey: "early_leave_minutes", header: t("summaryEarlyLeaveMinutes"), cell: ({ row }) => <Count value={row.original.early_leave_minutes ?? 0} locale={locale} /> },
    ],
    [isArabic, locale, t]
  );

  return <DataTable columns={columns} data={rows} emptyMessage={t("summaryEmpty")} isArabic={isArabic} />;
}

function Count({ value, locale }: { value: number; locale: string }) {
  return (
    <span className="text-sm font-black text-foreground tabular-nums">
      {value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
    </span>
  );
}
