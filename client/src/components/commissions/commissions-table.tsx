"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { Commission } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function CommissionsTable({ commissions }: { commissions: Commission[] }) {
  const locale = useLocale();
  const t = useTranslations("CommissionsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Commission>[]>(
    () => [
      {
        accessorKey: "id",
        header: t("tableCommission"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">#{row.original.id}</p>
            <p className="text-xs font-semibold text-muted-foreground">
              {formatDate(row.original.created_at, dateLocale)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "employee_id",
        header: t("tableEmployee"),
        cell: ({ row }) => (
          <span className="text-sm font-bold text-foreground tabular-nums">
            #{row.original.employee_id}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: t("tableSource"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-xs font-bold text-foreground">{formatSourceType(row.original.source.type)}</p>
            <p className="text-xs font-semibold text-muted-foreground tabular-nums">#{row.original.source.id}</p>
          </div>
        ),
      },
      {
        accessorKey: "month",
        header: t("tableMonth"),
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {row.original.month}
          </span>
        ),
      },
      {
        accessorKey: "rate",
        header: t("tableRate"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {(Number(row.original.rate) * 100).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 })}%
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: t("tableAmount"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.amount, locale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("tableStatus"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-bold",
              row.original.status === "paid"
                ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            )}
          >
            {row.original.status === "paid" ? t("statusPaid") : t("statusPending")}
          </Badge>
        ),
      },
    ],
    [dateLocale, isArabic, locale, t]
  );

  return <DataTable columns={columns} data={commissions} emptyMessage={t("empty")} isArabic={isArabic} />;
}

function formatSourceType(type: string) {
  return type.split("\\").pop()!.replace(/([a-z])([A-Z])/g, "$1 $2");
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

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
