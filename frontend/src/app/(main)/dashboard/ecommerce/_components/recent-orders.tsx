"use client";
"use no memo";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUpRight, Download, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { voidSale } from "./actions";
import type { PosRecentOrder } from "./data";
import { getRecentOrdersColumns } from "./recent-orders-table/columns";
import { preventPaginationNavigation } from "./recent-orders-table/formatters";
import { type OrderFilter, type OrderRow, orderFilters } from "./recent-orders-table/schema";

export function RecentOrders({ canVoidSale, orders }: { canVoidSale: boolean; orders: PosRecentOrder[] }) {
  const t = useTranslations("Dashboard.ecommerce");
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = React.useState<OrderRow | null>(null);
  const [voidPending, startVoidTransition] = React.useTransition();
  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([{ id: "statusSummary", value: "All" }]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const recentOrders = orders as OrderRow[];
  const handleVoidSale = React.useCallback(
    (order: OrderRow) => {
      startVoidTransition(async () => {
        const input = new FormData();
        input.set("id", order.id);
        input.set("reason", "Voided from POS table");

        const result = await voidSale(input);

        if (result.ok) {
          toast.success(result.message);
          router.refresh();
          return;
        }

        toast.error(t("saleNotVoided"), { description: result.message });
      });
    },
    [router, t],
  );
  const columns = React.useMemo(
    () => getRecentOrdersColumns(t, setSelectedOrder, handleVoidSale, canVoidSale),
    [canVoidSale, handleVoidSale, t],
  );

  const table = useReactTable({
    data: recentOrders,
    columns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const activeFilter = (table.getColumn("statusSummary")?.getFilterValue() as OrderFilter | undefined) ?? "All";
  const orderCount = table.getFilteredRowModel().rows.length;
  const selectedOrderCount = table.getSelectedRowModel().rows.length;
  const visibleOrderCount = table.getRowModel().rows.length;
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  const dateSort = table.getColumn("date")?.getIsSorted();
  const sortLabel = dateSort === "asc" ? t("oldestFirst") : t("newestFirst");
  let orderCountDescription = t("orderCount", { count: orderCount });

  if (selectedOrderCount > 0) {
    orderCountDescription = t("selectedOrderCount", { count: selectedOrderCount });
  } else if (activeFilter !== "All") {
    orderCountDescription = t("filteredOrderCount", {
      count: orderCount,
      filter: t(`orderFilters.${activeFilter}`).toLowerCase(),
    });
  }
  const pageNumbers = React.useMemo(() => {
    if (pageCount <= 3) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }

    if (currentPage <= 2) return [1, 2, 3];
    if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];

    return [currentPage - 1, currentPage, currentPage + 1];
  }, [currentPage, pageCount]);

  return (
    <Card id="recent-sales">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">{t("recentSales")}</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {orderCountDescription}
        </CardDescription>
        <CardAction className="flex items-center gap-1">
          <Button aria-label={t("openSales")} size="icon-sm" variant="outline">
            <ArrowUpRight />
          </Button>
          <Button aria-label={t("downloadSales")} size="icon-sm" variant="outline">
            <Download />
          </Button>
          <Button aria-label={t("moreSalesActions")} size="icon-sm" variant="outline">
            <MoreHorizontal />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex items-center justify-between px-4">
          <ToggleGroup
            className="bg-muted p-0.75 text-muted-foreground **:data-[slot=toggle-group-item]:rounded-md **:data-[slot=toggle-group-item]:border **:data-[slot=toggle-group-item]:border-transparent **:data-[slot=toggle-group-item]:text-foreground/60 **:data-[slot=toggle-group-item]:hover:text-foreground [&_[data-slot=toggle-group-item][data-pressed]]:bg-background [&_[data-slot=toggle-group-item][data-pressed]]:text-foreground [&_[data-slot=toggle-group-item][data-pressed]]:shadow-sm dark:[&_[data-slot=toggle-group-item][data-pressed]]:border-input dark:[&_[data-slot=toggle-group-item][data-pressed]]:bg-input/30"
            onValueChange={(value) => {
              const filter = value[0] as OrderFilter | undefined;
              if (!filter) return;
              table.getColumn("statusSummary")?.setFilterValue(filter === "All" ? undefined : filter);
              table.setPageIndex(0);
            }}
            size="sm"
            spacing={1}
            value={[activeFilter]}
          >
            {orderFilters.map((filter) => (
              <ToggleGroupItem key={filter} value={filter}>
                {t(`orderFilters.${filter}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Button
            aria-label={t("sortByDate", { direction: sortLabel })}
            disabled={voidPending}
            size="sm"
            variant="outline"
            onClick={() => table.getColumn("date")?.toggleSorting(table.getColumn("date")?.getIsSorted() === "asc")}
          >
            <ArrowUpDown />
            {sortLabel}
          </Button>
        </div>

        <div className="overflow-hidden">
          <Table className="**:data-[slot='table-cell']:px-4.5 **:data-[slot='table-head']:px-4.5">
            <TableHeader className="border-t **:data-[slot='table-head']:h-11 **:data-[slot='table-head']:font-normal **:data-[slot='table-head']:text-foreground **:data-[slot='table-head']:text-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot='table-row']:border-border/50 **:data-[slot='table-cell']:px-4 **:data-[slot='table-cell']:py-3 **:data-[slot='table-row']:hover:bg-transparent">
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-24 text-center" colSpan={table.getVisibleLeafColumns().length}>
                    {t("noSales")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 pb-1">
          <p className="text-muted-foreground text-sm">
            {t("viewingSales", { total: orderCount.toLocaleString(), visible: visibleOrderCount })}
          </p>

          {pageCount > 1 ? (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent className="gap-1.5">
                <PaginationItem>
                  <PaginationPrevious
                    className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : undefined}
                    href="#"
                    onClick={(event) => {
                      preventPaginationNavigation(event);
                      table.previousPage();
                    }}
                  />
                </PaginationItem>
                {pageNumbers[0] > 1 ? (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : null}
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={`page-${pageNumber}`}>
                    <PaginationLink
                      href="#"
                      isActive={table.getState().pagination.pageIndex === pageNumber - 1}
                      onClick={(event) => {
                        preventPaginationNavigation(event);
                        table.setPageIndex(pageNumber - 1);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                {pageNumbers[pageNumbers.length - 1] < pageCount ? (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : null}
                <PaginationItem>
                  <PaginationNext
                    className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : undefined}
                    href="#"
                    onClick={(event) => {
                      preventPaginationNavigation(event);
                      table.nextPage();
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      </CardContent>
      <SaleDetailsDialog order={selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)} />
    </Card>
  );
}

function SaleDetailsDialog({ onOpenChange, order }: { onOpenChange: (open: boolean) => void; order: OrderRow | null }) {
  const t = useTranslations("Dashboard.ecommerce");

  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{order ? t("saleDetailsTitle", { id: order.id }) : t("viewSale")}</DialogTitle>
          <DialogDescription>{t("saleDetailsDescription")}</DialogDescription>
        </DialogHeader>
        {order ? (
          <div className="grid gap-3 text-sm">
            <DetailRow label={t("member")} value={order.customer} />
            <DetailRow label={t("seller")} value={order.seller} />
            <DetailRow label={t("status")} value={`${order.payment} / ${order.status}`} />
            <DetailRow label={t("method")} value={order.payment_method.replaceAll("_", " ")} />
            <DetailRow label={t("total")} value={order.total} />
            <DetailRow label={t("date")} value={order.date ? new Date(order.date).toLocaleString() : t("noDate")} />
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground text-xs">{t("products")}</div>
              <div className="mt-1 font-medium">{order.items}</div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize">{value}</span>
    </div>
  );
}
