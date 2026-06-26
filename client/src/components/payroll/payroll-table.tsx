"use client";

import * as React from "react";
import { Banknote, Edit3, FileText, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { AppLocale } from "@/i18n/routing";
import { payPayroll } from "@/lib/actions/payroll";
import type { Payroll } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function PayrollTable({
  payroll,
  onAdjust,
}: {
  payroll: Payroll[];
  onAdjust: (payroll: Payroll) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("PayrollPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Payroll>[]>(
    () => [
      {
        accessorKey: "employee",
        header: t("tableEmployee"),
        cell: ({ row }) => (
          <div className={cn("min-w-48", isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              {row.original.employee.name ?? t("unknownEmployee")}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.employee.role ?? `#${row.original.employee.id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "month",
        header: t("tableMonth"),
        cell: ({ row }) => (
          <span className="text-sm font-bold text-foreground tabular-nums">
            {row.original.month}
          </span>
        ),
      },
      {
        accessorKey: "base_salary",
        header: t("tableBase"),
        cell: ({ row }) => <Money value={row.original.base_salary} locale={locale} />,
      },
      {
        accessorKey: "commissions_total",
        header: t("tableCommission"),
        cell: ({ row }) => <Money value={row.original.commissions_total} locale={locale} muted />,
      },
      {
        accessorKey: "bonuses",
        header: t("tableBonuses"),
        cell: ({ row }) => <Money value={row.original.bonuses} locale={locale} muted />,
      },
      {
        accessorKey: "deductions",
        header: t("tableDeductions"),
        cell: ({ row }) => <Money value={row.original.deductions} locale={locale} muted />,
      },
      {
        accessorKey: "net_salary",
        header: t("tableNet"),
        cell: ({ row }) => <Money value={row.original.net_salary} locale={locale} strong />,
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
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableActions")}
          </span>
        ),
        cell: ({ row }) => <PayrollActions payroll={row.original} onAdjust={onAdjust} />,
      },
    ],
    [dateLocale, isArabic, locale, onAdjust, t]
  );

  return (
    <DataTable
      columns={columns}
      data={payroll}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function PayrollActions({
  payroll,
  onAdjust,
}: {
  payroll: Payroll;
  onAdjust: (payroll: Payroll) => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("PayrollPage");
  const [isPending, setIsPending] = React.useState(false);
  const isPaid = payroll.status === "paid";

  async function handlePay() {
    if (isPaid) return;
    const confirmed = window.confirm(t("payConfirm", { name: payroll.employee.name ?? t("unknownEmployee") }));
    if (!confirmed) return;

    setIsPending(true);
    try {
      await payPayroll(payroll.id, locale as AppLocale);
      toast.success(t("payrollPaidSuccess"));
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      toast.error(parsed?.message ?? (err instanceof Error ? err.message : t("formError")));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionAdjust")} onClick={() => onAdjust(payroll)} disabled={isPaid}>
        <Edit3 className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionPay")} onClick={handlePay} disabled={isPaid || isPending}>
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Banknote className="size-3.5" />}
      </Button>
      <Button asChild type="button" variant="ghost" size="icon-sm" title={t("actionPayslip")}>
        <a href={`/api/media/payroll/${payroll.id}/payslip`} target="_blank" rel="noreferrer">
          <FileText className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

function Money({
  value,
  locale,
  muted,
  strong,
}: {
  value: string;
  locale: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-xs font-semibold tabular-nums",
        muted && "text-muted-foreground",
        strong ? "text-sm font-black text-foreground" : "text-foreground"
      )}
    >
      {formatCurrency(value, locale)}
    </span>
  );
}

function parseActionError(err: unknown): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;
  try {
    const parsed = JSON.parse(err.message) as { message?: string; details?: Record<string, string[]> };
    return parsed.message ? { message: parsed.message, details: parsed.details } : null;
  } catch {
    return null;
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
