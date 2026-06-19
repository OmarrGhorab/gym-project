"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { Payment } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  const locale = useLocale();
  const t = useTranslations("PaymentsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        accessorKey: "id",
        header: t("tablePayment"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              #{row.original.id}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.created_by
                ? t("createdBy", { id: row.original.created_by })
                : t("systemCreated")}
            </p>
          </div>
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
        accessorKey: "method",
        header: t("tableMethod"),
        cell: ({ row }) => (
          <Badge variant="outline" className="rounded-md text-xs font-bold">
            {paymentMethodLabel(row.original.method, t)}
          </Badge>
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
              statusClass(row.original.status)
            )}
          >
            {statusLabel(row.original.status, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "paid_at",
        header: t("tablePaidAt"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.paid_at, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "due_date",
        header: t("tableDueDate"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.due_date, dateLocale, true)}
          </span>
        ),
      },
    ],
    [dateLocale, isArabic, locale, t]
  );

  return (
    <DataTable
      columns={columns}
      data={payments}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function paymentMethodLabel(method: string, t: (key: string) => string) {
  switch (method) {
    case "card":
      return t("methodCard");
    case "bank_transfer":
      return t("methodBankTransfer");
    default:
      return t("methodCash");
  }
}

function statusLabel(status: string, t: (key: string) => string) {
  switch (status.toLowerCase()) {
    case "paid":
      return t("statusPaid");
    case "partial":
      return t("statusPartial");
    default:
      return status || "-";
  }
}

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
      return "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "partial":
      return "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
    default:
      return "border-muted-foreground/25 bg-muted text-muted-foreground";
  }
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

function formatDate(
  value: string | null | undefined,
  locale: string,
  dateOnly = false
) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}
