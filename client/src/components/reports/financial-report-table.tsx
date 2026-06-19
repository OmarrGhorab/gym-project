"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { FinancialReportRow } from "@/lib/api/dashboard";

export function FinancialReportTable({ rows }: { rows: FinancialReportRow[] }) {
  const locale = useLocale();
  const t = useTranslations("ReportsPage");
  const isArabic = locale === "ar";

  const columns = React.useMemo<ColumnDef<FinancialReportRow>[]>(
    () => [
      {
        accessorKey: "period",
        header: t("tablePeriod"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">{row.original.period}</span>
        ),
      },
      {
        accessorKey: "revenue",
        header: t("tableRevenue"),
        cell: ({ row }) => <Money value={row.original.revenue} locale={locale} />,
      },
      {
        accessorKey: "expenses",
        header: t("tableExpenses"),
        cell: ({ row }) => <Money value={row.original.expenses} locale={locale} />,
      },
      {
        accessorKey: "net_profit",
        header: t("tableNet"),
        cell: ({ row }) => <Money value={row.original.net_profit} locale={locale} strong />,
      },
    ],
    [locale, t]
  );

  return <DataTable columns={columns} data={rows} emptyMessage={t("emptyFinancial")} isArabic={isArabic} />;
}

function Money({ value, locale, strong }: { value: string; locale: string; strong?: boolean }) {
  const amount = Number(value);
  return (
    <span className={strong ? "text-sm font-black text-foreground tabular-nums" : "text-xs font-semibold text-muted-foreground tabular-nums"}>
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
