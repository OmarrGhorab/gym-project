"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { SalesPeriodReportRow } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function SalesPeriodReportTable({ rows }: { rows: SalesPeriodReportRow[] }) {
  const locale = useLocale();
  const t = useTranslations("ReportsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<SalesPeriodReportRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: t("salesReportDate"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              {row.original.sale_id ? `#${row.original.sale_id}` : row.original.date ?? "-"}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {formatDateTime(row.original.created_at ?? row.original.date, dateLocale)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "product_name",
        header: t("salesReportProduct"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-bold text-foreground">{row.original.product_name ?? "-"}</p>
            <p className="text-xs font-semibold text-muted-foreground">{row.original.product_sku ?? "-"}</p>
          </div>
        ),
      },
      {
        accessorKey: "cashier_name",
        header: t("salesReportSeller"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground">
            {row.original.cashier_name ?? row.original.sold_by_user_id ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "quantity",
        header: t("salesReportQuantity"),
        cell: ({ row }) => <Count value={row.original.quantity ?? row.original.units_sold ?? 0} locale={locale} />,
      },
      {
        accessorKey: "line_total",
        header: t("salesReportTotal"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.line_total ?? row.original.revenue ?? row.original.sale_total ?? "0", locale)}
          </span>
        ),
      },
    ],
    [dateLocale, isArabic, locale, t]
  );

  return <DataTable columns={columns} data={rows} emptyMessage={t("emptySalesReport")} isArabic={isArabic} />;
}

function Count({ value, locale }: { value: number; locale: string }) {
  return <span className="text-sm font-black text-foreground tabular-nums">{value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</span>;
}

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(value: string | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
