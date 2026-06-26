"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { EmployeePerformance } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function EmployeePerformanceReportTable({ rows }: { rows: EmployeePerformance[] }) {
  const locale = useLocale();
  const t = useTranslations("ReportsPage");
  const isArabic = locale === "ar";

  const columns = React.useMemo<ColumnDef<EmployeePerformance>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("tableEmployee"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">{row.original.name}</p>
            <p className="text-xs font-semibold text-muted-foreground">#{row.original.employee_id}</p>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: t("tableRole"),
        cell: ({ row }) => <Badge variant="outline" className="rounded-md text-xs font-bold">{row.original.role}</Badge>,
      },
      {
        accessorKey: "sales_count",
        header: t("tableSales"),
        cell: ({ row }) => <Count value={row.original.sales_count} locale={locale} />,
      },
      {
        accessorKey: "sales_volume",
        header: t("tableSalesVolume"),
        cell: ({ row }) => <Money value={row.original.sales_volume ?? "0.00"} locale={locale} />,
      },
      {
        accessorKey: "subscriptions_count",
        header: t("tableSubscriptions"),
        cell: ({ row }) => <Count value={row.original.subscriptions_count} locale={locale} />,
      },
      {
        accessorKey: "attendance_count",
        header: t("tableAttendance"),
        cell: ({ row }) => <Count value={row.original.attendance_count ?? 0} locale={locale} />,
      },
      {
        accessorKey: "commissions_earned",
        header: t("tableCommissions"),
        cell: ({ row }) => <Money value={row.original.commissions_earned} locale={locale} />,
      },
      {
        accessorKey: "comparison",
        header: t("tableComparison"),
        cell: ({ row }) => (
          <span className={cn("text-xs font-black tabular-nums", Number(row.original.comparison?.sales_volume_delta ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {formatDelta(row.original.comparison?.sales_volume_delta ?? "0.00", locale)}
          </span>
        ),
      },
    ],
    [isArabic, locale, t]
  );

  return <DataTable columns={columns} data={rows} emptyMessage={t("emptyEmployees")} isArabic={isArabic} />;
}

function formatDelta(value: string, locale: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const formatted = amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
  return amount > 0 ? `+${formatted}` : formatted;
}

function Count({ value, locale }: { value: number; locale: string }) {
  return <span className="text-sm font-black text-foreground tabular-nums">{value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</span>;
}

function Money({ value, locale }: { value: string; locale: string }) {
  const amount = Number(value);
  return (
    <span className="text-sm font-black text-foreground tabular-nums">
      {Number.isFinite(amount)
        ? amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
            style: "currency",
            currency: "EGP",
            maximumFractionDigits: 0,
          })
        : "-"}
    </span>
  );
}
