"use client";

import * as React from "react";
import { Edit3, Loader2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { AppLocale } from "@/i18n/routing";
import { deleteExpense } from "@/lib/actions/expenses";
import type { Expense } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function ExpensesTable({
  expenses,
  onEdit,
}: {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("ExpensesPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        accessorKey: "category",
        header: t("tableCategory"),
        cell: ({ row }) => (
          <div className={cn("min-w-56", isArabic && "text-right")}>
            <Badge variant="outline" className="rounded-md bg-muted/40 px-2 py-0.5 text-xs font-bold text-muted-foreground">
              {row.original.category}
            </Badge>
            <p className="mt-1 line-clamp-2 max-w-md text-xs font-semibold text-muted-foreground">
              {row.original.description || t("noDescription")}
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
        accessorKey: "date",
        header: t("tableDate"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.date, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "creator",
        header: t("tableCreator"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground">
            {row.original.creator?.name ?? "-"}
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
        cell: ({ row }) => <ExpenseActions expense={row.original} onEdit={onEdit} />,
      },
    ],
    [dateLocale, isArabic, locale, onEdit, t]
  );

  return (
    <DataTable
      columns={columns}
      data={expenses}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function ExpenseActions({
  expense,
  onEdit,
}: {
  expense: Expense;
  onEdit: (expense: Expense) => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("ExpensesPage");
  const [isPending, setIsPending] = React.useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(t("deleteConfirm", { category: expense.category }));
    if (!confirmed) return;

    setIsPending(true);
    try {
      await deleteExpense(expense.id, locale as AppLocale);
      toast.success(t("expenseDeletedSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionEdit")} onClick={() => onEdit(expense)}>
        <Edit3 className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionDelete")} onClick={handleDelete} disabled={isPending}>
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </Button>
    </div>
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
