"use client";

import * as React from "react";

import Image from "next/image";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PackageSearch,
  Plus,
  Search,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { getProductImageSrc, type InventoryLogisticsData, type PurchaseOrder } from "./shipment-data";

type OrderFilter = "all" | "delayed" | "open" | "received";

type ShipmentListProps = {
  data: InventoryLogisticsData;
  onOpenSummary: () => void;
  onSelectShipment: (shipmentId: PurchaseOrder["id"]) => void;
  selectedShipmentId: PurchaseOrder["id"] | null;
};

const statusClasses: Record<PurchaseOrder["status"], string> = {
  cancelled: "text-muted-foreground",
  delayed: "text-destructive",
  draft: "text-muted-foreground",
  ordered: "text-primary",
  partial: "text-amber-500",
  received: "text-green-600",
};

function ProductThumb({ order }: { order: PurchaseOrder }) {
  const product = order.primary_product;
  const src = getProductImageSrc(product);

  return (
    <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
      {src ? (
        <Image src={src} alt={product?.name || "Product"} fill unoptimized className="object-cover" sizes="48px" />
      ) : (
        <PackageSearch className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}

function ProductThumbBox({ product }: { product: InventoryLogisticsData["low_stock_products"][number] }) {
  const src = getProductImageSrc(product);

  return (
    <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
      {src ? (
        <Image src={src} alt={product.name} fill unoptimized className="object-cover" sizes="48px" />
      ) : (
        <PackageSearch className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}

function OrderCard({
  active,
  onSelectShipment,
  order,
}: {
  active?: boolean;
  onSelectShipment: (shipmentId: PurchaseOrder["id"]) => void;
  order: PurchaseOrder;
}) {
  const t = useTranslations("Dashboard.logistics");
  const angle = (order.progress / 100) * 360;

  let displayDate = t("notSet");
  if (order.status === "received") {
    if (order.received_at) {
      displayDate = order.received_at.substring(0, 10);
    }
  } else if (order.expected_at) {
    displayDate = order.expected_at;
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(event) => {
        event.currentTarget.blur();
        onSelectShipment(order.id);
      }}
      className={cn(
        "flex w-full flex-col gap-4 rounded-xl border p-3 text-left transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active && "border-primary bg-muted/50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium tabular-nums">#{order.reference}</div>
        <div className={cn("flex items-center gap-1 text-xs", statusClasses[order.status])}>
          <div
            style={{ "--angle": `${angle}deg` } as React.CSSProperties}
            className="grid size-3 place-items-center rounded-full bg-[conic-gradient(currentColor_0deg_var(--angle),transparent_var(--angle)_360deg)] p-[0.5px]"
          >
            <div className="grid size-2 place-items-center rounded-full bg-card">
              <div className="size-1 rounded-full bg-current" />
            </div>
          </div>
          <span>{t(`statuses.${order.status}`)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ProductThumb order={order} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-sm">{order.primary_product?.name || t("mixedProducts")}</div>
          <div className="truncate text-muted-foreground text-xs">
            {order.supplier_name} • {t("itemCount", { count: order.items_count })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <span
          className="h-px min-w-0 border-foreground border-t border-dashed"
          style={{ flexBasis: 0, flexGrow: order.progress }}
        />
        <Truck className="size-3.5" />
        <span
          className="h-px min-w-0 border-border border-t border-dashed"
          style={{ flexBasis: 0, flexGrow: 100 - order.progress }}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-muted-foreground text-xs leading-none">{t("units")}</div>
          <div className="text-sm tracking-tight">
            {t("receivedUnits", { ordered: order.ordered_units, received: order.received_units })}
          </div>
        </div>
        <div className="text-end">
          <div className="text-muted-foreground text-xs leading-none">
            {order.status === "received" ? t("received") : t("expected")}
          </div>
          <div className="text-sm tabular-nums tracking-tight">{displayDate}</div>
        </div>
      </div>
    </button>
  );
}

export function ShipmentList({ data, selectedShipmentId, onOpenSummary, onSelectShipment }: ShipmentListProps) {
  const t = useTranslations("Dashboard.logistics");
  const [filter, setFilter] = React.useState<OrderFilter>("all");
  const [search, setSearch] = React.useState("");

  const orders = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return data.purchase_orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.reference.toLowerCase().includes(query) ||
        order.supplier_name.toLowerCase().includes(query) ||
        order.primary_product?.name.toLowerCase().includes(query);
      const matchesFilter =
        filter === "all" ||
        (filter === "open" && ["ordered", "partial"].includes(order.status)) ||
        (filter === "received" && order.status === "received") ||
        (filter === "delayed" && order.status === "delayed");

      return matchesSearch && matchesFilter;
    });
  }, [data.purchase_orders, filter, search]);

  const tabs = [
    { icon: PackageSearch, label: t("all", { count: data.purchase_orders.length }), value: "all" },
    { icon: Clock3, label: t("open", { count: data.stats.open_purchase_orders }), value: "open" },
    { icon: CheckCircle2, label: t("receivedCount", { count: data.stats.received_this_month }), value: "received" },
    { icon: AlertTriangle, label: t("delayed"), value: "delayed" },
  ] as const;

  return (
    <Card className="h-full rounded-none ring-0">
      <CardHeader>
        <CardTitle className="font-normal text-xl">{t("inventoryLogistics")}</CardTitle>
        <CardAction>
          <Button size="icon-sm" variant="ghost" onClick={onOpenSummary} aria-label={t("openInventorySummary")}>
            <SlidersHorizontal />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden px-0">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as OrderFilter)}>
          <TabsList className="w-full border-b px-4" variant="line">
            {tabs.map((tab) => (
              <TabsTrigger className="gap-1 text-xs" key={tab.value} value={tab.value}>
                <tab.icon className="size-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="px-4">
          <InputGroup className="h-8">
            <InputGroupInput
              className="h-8"
              aria-label={t("searchOrders")}
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <ScrollArea className="h-0 flex-1">
          <div className="flex flex-col gap-4 px-4">
            {orders.length === 0 ? (
              <>
                <div className="rounded-xl border border-dashed p-4 text-muted-foreground text-sm">
                  <div className="font-medium text-foreground">{t("noPurchaseOrders")}</div>
                  <div className="mt-1">{t("restockHint")}</div>
                </div>
                {data.low_stock_products.slice(0, 8).map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={onOpenSummary}
                    className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ProductThumbBox product={product} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sm">{product.name}</div>
                      <div className="truncate text-muted-foreground text-xs">
                        {product.category} • SKU {product.sku}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">{product.stock_quantity}</div>
                      <div className="text-muted-foreground text-xs">{t("leftLabel")}</div>
                    </div>
                  </button>
                ))}
                {data.low_stock_products.length === 0 && (
                  <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                    {t("noLowStock")}
                  </div>
                )}
                <Button className="w-full" variant="outline" onClick={onOpenSummary}>
                  <Plus />
                  {t("viewStockSummary")}
                </Button>
              </>
            ) : (
              orders.map((order) => (
                <OrderCard
                  active={order.id === selectedShipmentId}
                  key={order.id}
                  order={order}
                  onSelectShipment={onSelectShipment}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
