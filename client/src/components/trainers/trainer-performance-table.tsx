"use client";

import * as React from "react";
import { Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { EmployeePerformance } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function TrainerPerformanceTable({
  rows,
}: {
  rows: EmployeePerformance[];
}) {
  const locale = useLocale();
  const t = useTranslations("TrainersPage");
  const isArabic = locale === "ar";

  const columns = React.useMemo<ColumnDef<EmployeePerformance>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("performanceName"),
        cell: ({ row }) => {
          const rank = rows.findIndex((item) => item.employee_id === row.original.employee_id) + 1;

          return (
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse text-right")}>
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-xs font-black text-amber-600 dark:text-amber-400">
                {rank <= 3 ? <Trophy className="size-4" /> : rank}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{row.original.name}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  #{row.original.employee_id}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: t("performanceRole"),
        cell: ({ row }) => (
          <Badge variant="outline" className="rounded-md border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            {row.original.role === "captain" ? t("roleCaptain") : row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: "subscriptions_count",
        header: t("performanceSubscriptions"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {row.original.subscriptions_count.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
          </span>
        ),
      },
      {
        accessorKey: "sales_count",
        header: t("performanceSales"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {row.original.sales_count.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
          </span>
        ),
      },
      {
        accessorKey: "commissions_earned",
        header: t("performanceCommissions"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.commissions_earned, locale)}
          </span>
        ),
      },
    ],
    [isArabic, locale, rows, t]
  );

  return <DataTable columns={columns} data={rows} emptyMessage={t("performanceEmpty")} isArabic={isArabic} />;
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
