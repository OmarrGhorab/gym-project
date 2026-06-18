"use client";

import * as React from "react";
import { Mail, MoreHorizontal, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Employee } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function TeamTable({
  employees,
  namespace = "TeamsPage",
}: {
  employees: Employee[];
  namespace?: "TeamsPage" | "TrainersPage";
}) {
  const locale = useLocale();
  const t = useTranslations(namespace);
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("tableName"),
        cell: ({ row }) => {
          const employee = row.original;

          return (
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse text-right")}>
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-black text-primary">
                {getInitials(employee.name)}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{employee.name}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  #{employee.id}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: t("tableRole"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("rounded-md border px-2 py-0.5 text-xs font-bold", roleClass(row.original.role))}>
            {roleLabel(row.original.role, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("tableStatus"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("rounded-md border px-2 py-0.5 text-xs font-bold", statusClass(row.original.status))}>
            {statusLabel(row.original.status, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "phone",
        header: t("tableContact"),
        cell: ({ row }) => (
          <div className="space-y-1 text-xs font-semibold text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Phone className="size-3" />
              {row.original.phone ?? "-"}
            </p>
            <p className="flex items-center gap-1.5">
              <Mail className="size-3" />
              {row.original.user?.email ?? "-"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "base_salary",
        header: t("tableSalary"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.base_salary, locale)}
          </span>
        ),
      },
      {
        accessorKey: "commission_rate",
        header: t("tableCommission"),
        cell: ({ row }) => (
          <span className="text-xs font-bold text-muted-foreground tabular-nums">
            {formatPercent(row.original.commission_rate, locale)}
          </span>
        ),
      },
      {
        accessorKey: "hire_date",
        header: t("tableHireDate"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.hire_date, dateLocale)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className={cn("block", isArabic ? "text-left" : "text-right")}>{t("tableActions")}</span>,
        cell: () => (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon-sm" disabled title={t("actionOpen")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [dateLocale, isArabic, locale, t]
  );

  return <DataTable columns={columns} data={employees} emptyMessage={t("empty")} isArabic={isArabic} />;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function roleLabel(role: string, t: (key: string) => string) {
  switch (role.toLowerCase()) {
    case "captain":
      return t("roleCaptain");
    case "manager":
      return t("roleManager");
    case "employee":
      return t("roleEmployee");
    default:
      return role || "-";
  }
}

function statusLabel(status: string, t: (key: string) => string) {
  return status.toLowerCase() === "active" ? t("statusActive") : t("statusInactive");
}

function roleClass(role: string) {
  switch (role.toLowerCase()) {
    case "captain":
      return "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "manager":
      return "border-violet-500/20 bg-violet-500/15 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400";
    default:
      return "border-slate-500/20 bg-slate-500/15 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";
  }
}

function statusClass(status: string) {
  return status.toLowerCase() === "active"
    ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
    : "border-slate-500/20 bg-slate-500/15 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
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

function formatPercent(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  });
}
