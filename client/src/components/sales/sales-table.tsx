"use client";

import * as React from "react";
import { Ban, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { voidSale } from "@/lib/actions/sales";
import type { AppLocale } from "@/i18n/routing";
import type { Sale } from "@/lib/api/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

export function SalesTable({ sales }: { sales: Sale[] }) {
  const locale = useLocale();
  const t = useTranslations("SalesPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Sale>[]>(
    () => [
      {
        accessorKey: "id",
        header: t("tableSale"),
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
        accessorKey: "member",
        header: t("tableMember"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-bold text-foreground">
              {row.original.member?.name ?? t("walkIn")}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.member?.phone ?? row.original.member_id ?? "-"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "items",
        header: t("tableItems"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground">
            {t("itemsCount", { count: getItemsCount(row.original) })}
          </span>
        ),
      },
      {
        accessorKey: "payment_method",
        header: t("tablePayment"),
        cell: ({ row }) => (
          <Badge variant="outline" className="rounded-md text-xs font-bold">
            {paymentLabel(row.original.payment_method, t)}
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
        accessorKey: "subtotal",
        header: t("tableSubtotal"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatCurrency(row.original.subtotal ?? row.original.total, locale)}
          </span>
        ),
      },
      {
        accessorKey: "discount",
        header: t("tableDiscount"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatCurrency(row.original.discount ?? 0, locale)}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: t("tableTotal"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.total, locale)}
          </span>
        ),
      },
      {
        accessorKey: "sold_by",
        header: t("tableCashier"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground">
            {row.original.sold_by?.name ?? "-"}
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
        cell: ({ row }) => <SaleActions sale={row.original} />,
      },
    ],
    [dateLocale, isArabic, locale, t]
  );

  return <DataTable columns={columns} data={sales} emptyMessage={t("empty")} isArabic={isArabic} />;
}

function SaleActions({ sale }: { sale: Sale }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("SalesPage");
  const [isPending, setIsPending] = React.useState(false);
  const isVoided = sale.status === "voided";

  async function handleVoid() {
    if (isVoided) return;
    const confirmed = window.confirm(t("voidConfirm", { id: sale.id }));
    if (!confirmed) return;

    setIsPending(true);
    try {
      await voidSale(sale.id, t("voidReason"), locale as AppLocale);
      toast.success(t("voidSuccess"));
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      toast.error(parsed?.message ?? (err instanceof Error ? err.message : t("voidError")));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionVoid")} onClick={handleVoid} disabled={isPending || isVoided}>
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
      </Button>
    </div>
  );
}

function getItemsCount(sale: Sale) {
  return sale.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}

function paymentLabel(method: string, t: (key: string) => string) {
  switch (method) {
    case "card":
      return t("paymentCard");
    case "bank_transfer":
      return t("paymentBank");
    default:
      return t("paymentCash");
  }
}

function statusLabel(status: string, t: (key: string) => string) {
  return status === "voided" ? t("statusVoided") : t("statusCompleted");
}

function statusClass(status: string) {
  return status === "voided"
    ? "border-rose-500/20 bg-rose-500/15 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
    : "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
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

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseActionError(err: unknown): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;
  try {
    const parsed = JSON.parse(err.message) as {
      message?: string;
      details?: Record<string, string[]>;
    };
    return parsed.message ? { message: parsed.message, details: parsed.details } : null;
  } catch {
    return null;
  }
}
