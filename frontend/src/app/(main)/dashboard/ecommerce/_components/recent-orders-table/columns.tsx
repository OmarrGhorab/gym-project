import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import type { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { voidSale } from "../actions";
import { formatEgp } from "../format";
import type { OrderRow } from "./schema";

type EcommerceT = ReturnType<typeof useTranslations<"Dashboard.ecommerce">>;

function formatOrderDate(date: string | null, t: EcommerceT) {
  if (!date) {
    return t("noDate");
  }

  return format(parseISO(date), "h:mm a, d MMM yyyy");
}

function PaymentBadge({ status, t }: { status: OrderRow["payment"]; t: EcommerceT }) {
  if (status === "Paid") {
    return (
      <Badge
        className="border-green-700/25 text-green-700 dark:border-green-300/25 dark:text-green-300"
        variant="outline"
      >
        <span className="size-1.5 rounded-full bg-current" />
        {t("orderFilters.Paid")}
      </Badge>
    );
  }

  return (
    <Badge
      className="border-yellow-700/25 text-yellow-700 dark:border-yellow-300/25 dark:text-yellow-300"
      variant="outline"
    >
      <span className="size-1.5 rounded-full bg-current" />
      {t("orderFilters.Pending")}
    </Badge>
  );
}

function SaleStatusBadge({ status, t }: { status: string; t: EcommerceT }) {
  const isCompleted = status.toLowerCase() === "completed";
  const normalized = status.toLowerCase();
  let label = status;

  if (normalized === "completed") {
    label = t("orderFilters.Completed");
  } else if (normalized === "voided") {
    label = t("orderFilters.Voided");
  }

  return (
    <Badge variant={isCompleted ? "outline" : "destructive"}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

function getPaymentMethodLabel(method: string, t: EcommerceT) {
  if (method === "cash" || method === "card" || method === "bank_transfer" || method === "wallet") {
    return t(`paymentMethodsShort.${method}`);
  }

  return method ? method.replaceAll("_", " ") : t("paymentMethodsShort.unknown");
}

export function getRecentOrdersColumns(t: EcommerceT): ColumnDef<OrderRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="w-10">
          <Checkbox
            aria-label={t("selectAllOrders")}
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="w-10">
          <Checkbox
            aria-label={t("selectOrder", { id: row.original.id })}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      accessorKey: "id",
      header: t("sale"),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <div className="font-medium leading-none">{row.original.id}</div>
          <div className="text-muted-foreground text-xs">{row.original.items}</div>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "customer",
      header: t("member"),
    },
    {
      accessorKey: "seller",
      header: t("seller"),
    },
    {
      id: "statusSummary",
      header: t("status"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PaymentBadge status={row.original.payment} t={t} />
          <SaleStatusBadge status={row.original.status} t={t} />
        </div>
      ),
      filterFn: (row, _columnId, value) => {
        if (value === "Paid") {
          return row.original.payment === "Paid";
        }

        if (value === "Pending") {
          return row.original.payment === "Pending";
        }

        if (value === "Completed") {
          return row.original.status.toLowerCase() === "completed";
        }

        if (value === "Voided") {
          return row.original.status.toLowerCase() === "voided";
        }

        return true;
      },
    },
    {
      accessorKey: "payment_method",
      header: () => <div className="w-28">{t("method")}</div>,
      cell: ({ row }) => (
        <div className="w-28 text-muted-foreground">{getPaymentMethodLabel(row.original.payment_method, t)}</div>
      ),
    },
    {
      accessorKey: "total",
      header: () => <div className="w-28">{t("total")}</div>,
      cell: ({ row }) => <div className="w-28 tabular-nums">{formatEgp(row.original.total)}</div>,
    },
    {
      accessorKey: "date",
      header: () => <div className="w-44">{t("date")}</div>,
      cell: ({ row }) => <div className="w-44 text-muted-foreground">{formatOrderDate(row.original.date, t)}</div>,
    },
    {
      id: "actions",
      header: () => <div className="flex w-full justify-end">{t("actions")}</div>,
      cell: ({ row }) => (
        <div className="flex w-full justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label={t("openSaleActions")} size="icon-sm" variant="ghost" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>{t("saleActions")}</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem>{t("viewSale")}</DropdownMenuItem>
                <DropdownMenuItem render={<a href={`/api/sales/${row.original.id.replace(/^#/, "")}/receipt`} />}>
                  {t("downloadReceipt")}
                </DropdownMenuItem>
                <DropdownMenuItem>{t("copySaleId")}</DropdownMenuItem>
                {row.original.status.toLowerCase() !== "voided" ? (
                  <DropdownMenuItem
                    render={
                      <form action={voidSale}>
                        <input type="hidden" name="id" value={row.original.id} />
                        <input type="hidden" name="reason" value="Voided from POS table" />
                        <button type="submit" className="w-full text-left">
                          {t("voidSale")}
                        </button>
                      </form>
                    }
                    nativeButton={false}
                  />
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
    },
  ];
}
