"use client";

import * as React from "react";

import Image from "next/image";

import {
  AlertTriangleIcon,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { type ProductActionPermissions, ReceivePurchaseOrderForm } from "./logistics-actions";
import { ProductImage } from "./product-image";
import { ProductsGrid } from "./products-grid";
import { ProductsTab } from "./products-tab";
import {
  getPurchaseOrderImageSrc,
  type InventoryLogisticsData,
  type InventoryMovement,
  type PurchaseOrder,
} from "./shipment-data";

type ShipmentDetailsProps = {
  data: InventoryLogisticsData;
  permissions: ProductActionPermissions;
  shipment: PurchaseOrder | null;
};

const statusBadgeClasses: Record<PurchaseOrder["status"], string> = {
  cancelled: "border-muted bg-muted/50 text-muted-foreground",
  delayed: "border-destructive/20 bg-destructive/10 text-destructive",
  draft: "border-muted bg-muted/50 text-muted-foreground",
  ordered: "border-primary/20 bg-primary/10 text-primary",
  partial: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  received: "border-green-600/20 bg-green-600/10 text-green-600",
};

function formatEgp(value: string | number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: "EGP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value) || 0);
}

function EmptyOrderOverview({
  data,
  permissions,
}: {
  data: InventoryLogisticsData;
  permissions: ProductActionPermissions;
}) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[280px_1fr] overflow-hidden lg:grid-rows-[360px_1fr]">
      <InventoryHero data={data} order={null} />
      <div className="min-h-0 overflow-hidden p-4">
        <ProductsTab data={data} permissions={permissions} />
      </div>
    </div>
  );
}

function InventoryHero({ data, order }: { data: InventoryLogisticsData; order: PurchaseOrder | null }) {
  const t = useTranslations("Dashboard.logistics");
  const locale = useLocale();
  const heroProducts =
    order?.items
      .map((item) => item.product)
      .filter(Boolean)
      .slice(0, 4) ?? data.products.slice(0, 4);

  return (
    <div className="relative overflow-hidden border-b bg-muted/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--primary)_0,transparent_22%),radial-gradient(circle_at_80%_30%,var(--muted-foreground)_0,transparent_18%)] opacity-[0.08]" />
      <div className="relative flex h-full flex-col justify-between gap-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs">
              <Boxes className="size-3.5" />
              {t("stockOperations")}
            </div>
            <div>
              <h2 className="text-3xl tracking-tight">{order?.reference ?? t("inventoryLogistics")}</h2>
              <p className="text-muted-foreground text-sm">
                {order
                  ? `${order.supplier_name} • ${t("productLines", { count: order.items_count })}`
                  : t("movementDescription")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-xs">
            <div className="rounded-lg border bg-background/70 p-3">
              <div className="text-muted-foreground">{t("lowStock")}</div>
              <div className="text-foreground text-lg">{data.stats.low_stock_products}</div>
            </div>
            <div className="rounded-lg border bg-background/70 p-3">
              <div className="text-muted-foreground">{t("openPo")}</div>
              <div className="text-foreground text-lg">{data.stats.open_purchase_orders}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex -space-x-3">
            {heroProducts.map((product) => (
              <ProductImage key={product?.id} product={product ?? null} />
            ))}
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs">{t("inventoryValue")}</div>
            <div className="text-2xl tracking-tight">{formatEgp(data.stats.inventory_value, locale)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderOverview({ order, permissions }: { order: PurchaseOrder; permissions: ProductActionPermissions }) {
  const t = useTranslations("Dashboard.logistics");
  const locale = useLocale();

  let displayDate = t("notSet");
  if (order.status === "received") {
    if (order.received_at) {
      displayDate = order.received_at.substring(0, 10);
    }
  } else if (order.expected_at) {
    displayDate = order.expected_at;
  }

  const lowProducts = order.items.filter((item) => item.product?.is_low_stock);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <h1 className="font-medium text-lg tabular-nums tracking-tight sm:text-xl">#{order.reference}</h1>
          <Button variant="ghost" size="icon-sm" aria-label={t("copyPoReference")}>
            <Copy />
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Badge variant="outline" className={cn("gap-1.5", statusBadgeClasses[order.status])}>
            <span className="size-1.5 rounded-full bg-current" />
            {t(`statuses.${order.status}`)}
          </Badge>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground tabular-nums">{t("progressReceived", { percent: order.progress })}</span>
          <span className="text-muted-foreground">·</span>
          {order.status === "received" ? (
            <span className="text-foreground tabular-nums">
              {t("received")}: {displayDate}
            </span>
          ) : (
            <span className="text-foreground tabular-nums">{t("eta", { date: displayDate })}</span>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-6">
        <div className="col-span-2 flex flex-col gap-1 md:col-span-1 md:gap-2">
          <div className="text-muted-foreground text-xs leading-none md:text-sm">{t("supplier")}</div>
          <div className="whitespace-nowrap text-sm leading-none">{order.supplier_name}</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs leading-none md:text-sm">{t("totalCost")}</div>
          <div className="text-sm leading-none">{formatEgp(order.subtotal, locale)}</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs leading-none md:text-sm">{t("units")}</div>
          <div className="text-sm leading-none">
            {order.received_units}/{order.ordered_units}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs leading-none md:text-sm">{t("ordered")}</div>
          <div className="text-sm leading-none">{order.ordered_at ?? t("notSet")}</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs leading-none md:text-sm">
            {order.status === "received" ? t("received") : t("expected")}
          </div>
          <div className="text-sm leading-none">{displayDate}</div>
        </div>
        <div className="flex flex-col gap-2 md:text-right">
          <div className="text-muted-foreground text-xs leading-none md:text-sm">{t("products")}</div>
          <div className="text-sm leading-none">{t("lines", { count: order.items_count })}</div>
        </div>
      </div>

      <Separator />

      {lowProducts.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
          <AlertTriangleIcon />
          <AlertTitle>{t("lowStockIncluded")}</AlertTitle>
          <AlertDescription>{t("lowStockIncludedDescription", { count: lowProducts.length })}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3">
        {order.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border p-3">
            <ProductImage product={item.product} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium text-sm">{item.product?.name ?? t("product")}</div>
              <div className="truncate text-muted-foreground text-xs">
                {item.product?.category ?? t("uncategorized")} • SKU {item.product?.sku ?? "-"} • {t("stock")}{" "}
                {item.product?.stock_quantity ?? 0}
              </div>
            </div>
            <div className="text-right text-sm">
              <div>
                {item.quantity_received}/{item.quantity_ordered}
              </div>
              <div className="text-muted-foreground text-xs">{formatEgp(item.line_total, locale)}</div>
            </div>
          </div>
        ))}
      </div>

      {permissions.canAdjustInventory && order.status !== "received" ? (
        <ReceivePurchaseOrderForm order={order} />
      ) : null}

      {order.notes && (
        <Card>
          <CardContent className="p-4 text-sm">{order.notes}</CardContent>
        </Card>
      )}

      {(() => {
        const imageSrc = getPurchaseOrderImageSrc(order);
        if (!imageSrc) return null;
        return (
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="font-medium text-muted-foreground text-xs">{t("receiptOrInvoice")}</div>
              <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border bg-muted">
                <Image src={imageSrc} alt={t("receiptOrInvoice")} fill unoptimized className="object-contain" />
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function Activity({ data, order }: { data: InventoryLogisticsData; order: PurchaseOrder }) {
  const t = useTranslations("Dashboard.logistics");

  const [search, setSearch] = React.useState(order.reference);
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedMovement, setSelectedMovement] = React.useState<InventoryMovement | null>(null);

  const getMovementTypeLabel = (type: string) => {
    if (type === "adjust") return "Manual Adjustment";
    if (type === "in") return "Inflow";
    return "Outflow";
  };

  // Update search when the selected order changes
  React.useEffect(() => {
    setSearch(order.reference);
  }, [order.reference]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, []);

  const filteredMovements = React.useMemo(() => {
    return data.recent_movements.filter((m) => {
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        m.product?.name.toLowerCase().includes(query) ||
        m.reason?.toLowerCase().includes(query) ||
        m.creator?.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "in" && m.type === "in") ||
        (typeFilter === "out" && m.type === "out") ||
        (typeFilter === "adjust" && m.type === "adjust");

      return matchesSearch && matchesType;
    });
  }, [data.recent_movements, search, typeFilter]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);

  const paginatedMovements = React.useMemo(() => {
    return filteredMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredMovements, currentPage]);

  // Find associated purchase order for the selected movement (if any)
  const associatedPo = React.useMemo(() => {
    if (!selectedMovement?.reason) return null;
    return data.purchase_orders.find((po) => selectedMovement.reason?.includes(po.reference));
  }, [selectedMovement, data.purchase_orders]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Input
            className="h-8 pl-8 text-xs"
            aria-label={t("searchActivity")}
            placeholder={t("searchActivity")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-3.5"
            >
              <title>Search Icon</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
              />
            </svg>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val ?? "all")}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder={t("allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="in">{t("inflow")}</SelectItem>
              <SelectItem value="out">{t("outflow")}</SelectItem>
              <SelectItem value="adjust">{t("adjustments")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3">
        {filteredMovements.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            {t("noInventoryActivity")}
          </div>
        ) : (
          paginatedMovements.map((movement) => (
            <button
              key={movement.id}
              type="button"
              onClick={() => setSelectedMovement(movement)}
              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ProductImage product={movement.product} size="sm" />
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground text-sm">
                  {movement.product?.name ?? t("product")}
                </div>
                <div className="truncate text-muted-foreground text-xs">{movement.reason}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={movement.quantity < 0 ? "destructive" : "outline"}>
                  {movement.quantity > 0 ? "+" : ""}
                  {movement.quantity}
                </Badge>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination (Always visible, disabled if only 1 page) */}
      <div className="mt-auto flex items-center justify-between border-t pt-3">
        <p className="text-muted-foreground text-xs">
          {t("pageInfo", { page: currentPage, lastPage: Math.max(totalPages, 1) })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={currentPage >= totalPages || totalPages <= 1}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog open={selectedMovement !== null} onOpenChange={(open) => !open && setSelectedMovement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-semibold text-base">
              <CheckCircle2 className="size-5 text-green-500" />
              Activity Details
            </DialogTitle>
          </DialogHeader>

          {selectedMovement && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <ProductImage product={selectedMovement.product} size="lg" />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-sm">{selectedMovement.product?.name}</div>
                  <div className="truncate text-muted-foreground text-xs">SKU: {selectedMovement.product?.sku}</div>
                </div>
                <Badge className="ml-auto" variant={selectedMovement.quantity < 0 ? "destructive" : "outline"}>
                  {selectedMovement.quantity > 0 ? "+" : ""}
                  {selectedMovement.quantity} units
                </Badge>
              </div>

              {associatedPo ? (
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <User className="size-3.5" /> Received By
                    </span>
                    <span className="font-medium text-foreground text-sm">
                      {associatedPo.receiver_name ?? selectedMovement.creator ?? t("notSet")}
                    </span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <Calendar className="size-3.5" /> Expected
                    </span>
                    <span className="font-medium text-foreground text-sm tabular-nums">
                      {associatedPo.expected_at ?? t("notSet")}
                    </span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <Calendar className="size-3.5" /> Received At
                    </span>
                    <span className="font-medium text-foreground text-sm tabular-nums">
                      {associatedPo.received_at
                        ? associatedPo.received_at.substring(0, 16).replace("T", " ")
                        : t("notSet")}
                    </span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <Calendar className="size-3.5" /> Ordered At
                    </span>
                    <span className="font-medium text-foreground text-sm tabular-nums">
                      {associatedPo.ordered_at ?? t("notSet")}
                    </span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <FileText className="size-3.5" /> Supplier
                    </span>
                    <span className="font-medium text-foreground text-sm">{associatedPo.supplier_name}</span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <FileText className="size-3.5" /> PO Reference
                    </span>
                    <span className="font-semibold text-foreground text-sm tabular-nums">
                      #{associatedPo.reference}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <User className="size-3.5" /> Action By
                    </span>
                    <span className="font-medium text-foreground text-sm">
                      {selectedMovement.creator ?? t("notSet")}
                    </span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <FileText className="size-3.5" /> Activity Type
                    </span>
                    <span className="font-medium text-foreground text-sm capitalize">
                      {getMovementTypeLabel(selectedMovement.type)}
                    </span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <FileText className="size-3.5" /> Reason
                    </span>
                    <span className="font-medium text-foreground text-sm">{selectedMovement.reason}</span>
                  </div>

                  <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <Calendar className="size-3.5" /> Date / Time
                    </span>
                    <span className="font-medium text-foreground text-sm tabular-nums">
                      {selectedMovement.created_at
                        ? selectedMovement.created_at.substring(0, 16).replace("T", " ")
                        : t("notSet")}
                    </span>
                  </div>
                </div>
              )}

              {associatedPo?.notes && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-1 font-medium text-muted-foreground text-xs">PO Notes</div>
                  <div className="text-foreground text-xs italic">"{associatedPo.notes}"</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ShipmentDetails({ data, permissions, shipment }: ShipmentDetailsProps) {
  const t = useTranslations("Dashboard.logistics");

  if (!shipment) {
    return <EmptyOrderOverview data={data} permissions={permissions} />;
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[280px_1fr] overflow-hidden lg:grid-rows-[360px_1fr]">
      <InventoryHero data={data} order={shipment} />
      <div className="min-h-0 overflow-hidden">
        <div className="h-full min-h-0 py-2">
          <Tabs defaultValue="overview" className="h-full gap-0">
            <TabsList
              className="w-full justify-start gap-2 border-b px-4 **:data-[slot=tabs-trigger]:text-xs sm:gap-4 sm:**:data-[slot=tabs-trigger]:text-sm"
              variant="line"
            >
              <TabsTrigger className="flex-none" value="overview">
                {t("overview")}
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="products">
                {t("products")}
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="alerts">
                {t("alerts")}
              </TabsTrigger>
              <TabsTrigger className="flex-none" value="activity">
                {t("activity")}
              </TabsTrigger>
            </TabsList>
            <TabsContent className="min-h-0 overflow-auto p-4" value="overview">
              <OrderOverview order={shipment} permissions={permissions} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-hidden p-4" value="products">
              <ProductsTab data={data} permissions={permissions} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-auto p-4" value="alerts">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">{t("lowStockProducts")}</h3>
                  <p className="text-muted-foreground text-xs">{t("summaryDescription")}</p>
                </div>
                <Badge variant="outline">{t("itemCount", { count: data.low_stock_products.length })}</Badge>
              </div>
              <ProductsGrid products={data.low_stock_products} permissions={permissions} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-auto p-4" value="activity">
              <Activity data={data} order={shipment} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
