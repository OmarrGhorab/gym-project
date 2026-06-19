"use client";

import * as React from "react";
import { WalletCards } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { PaymentDue } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type PaymentDuesTableProps = {
  dues: PaymentDue[];
  onCollect: (due: PaymentDue) => void;
};

export function PaymentDuesTable({ dues, onCollect }: PaymentDuesTableProps) {
  const locale = useLocale();
  const t = useTranslations("PaymentsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<PaymentDue>[]>(
    () => [
      {
        accessorKey: "member",
        header: t("tableMember"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              {row.original.member.name ?? t("unknownMember")}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.member.id
                ? `#${row.original.member.id}`
                : t("noMemberId")}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "subscription",
        header: t("tableSubscription"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-bold text-foreground">
              #{row.original.subscription.id}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {formatDate(row.original.subscription.end_date, dateLocale)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "price_paid",
        header: t("tableTotal"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.price_paid, locale)}
          </span>
        ),
      },
      {
        accessorKey: "paid_total",
        header: t("tablePaidTotal"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatCurrency(row.original.paid_total, locale)}
          </span>
        ),
      },
      {
        accessorKey: "balance",
        header: t("tableBalance"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-amber-700 tabular-nums dark:text-amber-300">
            {formatCurrency(row.original.balance, locale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("tableStatus"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="rounded-md border border-amber-500/20 bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
          >
            {row.original.subscription.status}
          </Badge>
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
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onCollect(row.original)}
            >
              <WalletCards className="size-3.5" />
              {t("actionCollect")}
            </Button>
          </div>
        ),
      },
    ],
    [dateLocale, isArabic, locale, onCollect, t]
  );

  return (
    <DataTable
      columns={columns}
      data={dues}
      emptyMessage={t("emptyDues")}
      isArabic={isArabic}
    />
  );
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

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
