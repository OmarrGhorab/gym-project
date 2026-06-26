"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { MemberVisit } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function MemberVisitsTable({ visits }: { visits: MemberVisit[] }) {
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<MemberVisit>[]>(
    () => [
      {
        accessorKey: "member",
        header: t("memberVisitTableMember"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              {row.original.member?.name ?? `#${row.original.member_id}`}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.member?.phone ?? `#${row.original.member_id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "check_in_at",
        header: t("memberVisitTableCheckIn"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDateTime(row.original.check_in_at, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("memberVisitTableStatus"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("rounded-md text-xs font-bold", row.original.status === "blocked" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
            {row.original.status === "blocked" ? t("memberVisitStatusBlocked") : t("memberVisitStatusAllowed")}
          </Badge>
        ),
      },
      {
        accessorKey: "alert_reason",
        header: t("memberVisitTableAlert"),
        cell: ({ row }) => (
          <p className="line-clamp-2 min-w-48 text-xs font-semibold text-muted-foreground">
            {row.original.alert_reason ?? row.original.subscription?.plan_name ?? "-"}
          </p>
        ),
      },
    ],
    [dateLocale, isArabic, t]
  );

  return <DataTable columns={columns} data={visits} emptyMessage={t("memberVisitEmpty")} isArabic={isArabic} />;
}

function formatDateTime(value: string | undefined, locale: string) {
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
