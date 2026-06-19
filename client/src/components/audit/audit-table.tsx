"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { AuditLog } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function AuditTable({ logs }: { logs: AuditLog[] }) {
  const locale = useLocale();
  const t = useTranslations("AuditPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: t("tableTime"),
        cell: ({ row }) => (
          <div className={cn("min-w-32", isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground tabular-nums">
              {formatDate(row.original.created_at, dateLocale)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              #{row.original.id}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: t("tableAction"),
        cell: ({ row }) => (
          <div className={cn("min-w-48", isArabic && "text-right")}>
            <Badge
              variant="outline"
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-bold",
                actionClass(row.original.action)
              )}
            >
              {actionLabel(row.original.action, t)}
            </Badge>
            <p className="mt-1 line-clamp-2 max-w-xs text-xs font-semibold text-muted-foreground">
              {row.original.description}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "subject",
        header: t("tableSubject"),
        cell: ({ row }) =>
          row.original.subject ? (
            <div className={cn(isArabic && "text-right")}>
              <p className="text-sm font-bold text-foreground">
                {subjectLabel(row.original.subject.type, t)}
              </p>
              <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                #{row.original.subject.id}
              </p>
            </div>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {t("noSubject")}
            </span>
          ),
      },
      {
        accessorKey: "causer",
        header: t("tableCauser"),
        cell: ({ row }) =>
          row.original.causer ? (
            <div className={cn(isArabic && "text-right")}>
              <p className="text-sm font-bold text-foreground">
                {row.original.causer.name}
              </p>
              <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                #{row.original.causer.id}
              </p>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="rounded-md bg-muted/40 px-2 py-0.5 text-xs font-bold text-muted-foreground"
            >
              {t("systemCauser")}
            </Badge>
          ),
      },
      {
        accessorKey: "changes",
        header: t("tableChanges"),
        cell: ({ row }) => (
          <div className="max-w-sm">
            <p className="line-clamp-2 rounded-md bg-muted/35 px-2 py-1 font-mono text-xs text-muted-foreground">
              {summarizeObject(row.original.changes) ||
                summarizeObject(row.original.properties) ||
                t("noChanges")}
            </p>
          </div>
        ),
      },
    ],
    [dateLocale, isArabic, t]
  );

  return (
    <DataTable
      columns={columns}
      data={logs}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: string, t: (key: string) => string) {
  const normalized = action.toLowerCase();
  if (normalized === "created") return t("actionCreated");
  if (normalized === "updated") return t("actionUpdated");
  if (normalized === "deleted") return t("actionDeleted");
  return action;
}

function actionClass(action: string) {
  const normalized = action.toLowerCase();

  if (normalized === "created") {
    return "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (normalized === "updated") {
    return "border-sky-500/20 bg-sky-500/15 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
  }

  if (normalized === "deleted") {
    return "border-rose-500/20 bg-rose-500/15 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  }

  return "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
}

function subjectLabel(subject: string, t: (key: string) => string) {
  const knownSubjects = new Set([
    "member",
    "subscription",
    "sale",
    "payment",
    "payroll",
    "commission",
    "employee",
    "expense",
    "inventory_movement",
    "product",
    "plan",
    "subscription_freeze",
  ]);

  if (knownSubjects.has(subject)) {
    return t(`subjects.${subject}`);
  }

  return subject
    .split("\\")
    .pop()!
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");
}

function summarizeObject(value: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) return "";

  const text = JSON.stringify(value);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
