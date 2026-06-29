"use client";

import Image from "next/image";

import { AlertTriangleIcon, Boxes, Copy, PackageSearch } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  getProductImageSrc,
  type InventoryLogisticsData,
  type InventoryProduct,
  type PurchaseOrder,
} from "./shipment-data";
import { ProductQuickActions, ReceivePurchaseOrderForm } from "./logistics-actions";

type ShipmentDetailsProps = {
  data: InventoryLogisticsData;
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

function ProductImage({ product, size = "lg" }: { product: InventoryProduct | null; size?: "lg" | "sm" }) {
  const t = useTranslations("Dashboard.logistics");
  const src = getProductImageSrc(product);
  const className = size === "lg" ? "size-16 rounded-xl" : "size-10 rounded-lg";

  return (
    <div className={cn("relative grid shrink-0 place-items-center overflow-hidden border bg-muted", className)}>
      {src ? (
        <Image
          src={src}
          alt={product?.name ?? t("product")}
          fill
          className="object-cover"
          sizes={size === "lg" ? "64px" : "40px"}
        />
      ) : (
        <PackageSearch className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}

function EmptyOrderOverview({ data }: { data: InventoryLogisticsData }) {
  const t = useTranslations("Dashboard.logistics");

  return (
    <div className="grid h-full min-h-0 grid-rows-[280px_1fr] overflow-hidden lg:grid-rows-[360px_1fr]">
      <InventoryHero data={data} order={null} />
      <div className="min-h-0 overflow-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">{t("lowStockProducts")}</h3>
            <p className="text-muted-foreground text-xs">{t("summaryDescription")}</p>
          </div>
          <Badge variant="outline">{t("itemCount", { count: data.low_stock_products.length })}</Badge>
        </div>
        <LowStockProducts products={data.low_stock_products} />
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
      .slice(0, 4) ?? data.low_stock_products.slice(0, 4);

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

function OrderOverview({ order }: { order: PurchaseOrder }) {
  const t = useTranslations("Dashboard.logistics");
  const locale = useLocale();
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
          <span className="text-foreground tabular-nums">{t("eta", { date: order.expected_at ?? t("notSet") })}</span>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-5">
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

      {order.status !== "received" ? <ReceivePurchaseOrderForm order={order} /> : null}

      {order.notes && (
        <Card>
          <CardContent className="p-4 text-sm">{order.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}

function LowStockProducts({ products }: { products: InventoryProduct[] }) {
  const t = useTranslations("Dashboard.logistics");

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {products.length === 0 ? (
        <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          {t("noLowStock")}
        </div>
      ) : (
        products.map((product) => (
          <div key={product.id} className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-3">
            <ProductImage product={product} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-sm">{product.name}</div>
              <div className="truncate text-muted-foreground text-xs">
                {product.category} • {t("threshold", { value: product.low_stock_threshold })}
              </div>
            </div>
            <Badge variant={product.stock_quantity <= 0 ? "destructive" : "outline"}>
              {t("left", { count: product.stock_quantity })}
            </Badge>
            </div>
            <ProductQuickActions product={product} compact />
          </div>
        ))
      )}
    </div>
  );
}

function Activity({ data }: { data: InventoryLogisticsData }) {
  const t = useTranslations("Dashboard.logistics");

  return (
    <div className="grid gap-3">
      {data.recent_movements.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          {t("noInventoryActivity")}
        </div>
      ) : (
        data.recent_movements.map((movement) => (
          <div key={movement.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border p-3">
            <ProductImage product={movement.product} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium text-sm">{movement.product?.name ?? t("product")}</div>
              <div className="truncate text-muted-foreground text-xs">{movement.reason}</div>
            </div>
            <Badge variant={movement.quantity < 0 ? "destructive" : "outline"}>
              {movement.quantity > 0 ? "+" : ""}
              {movement.quantity}
            </Badge>
          </div>
        ))
      )}
    </div>
  );
}

export function ShipmentDetails({ data, shipment }: ShipmentDetailsProps) {
  const t = useTranslations("Dashboard.logistics");

  if (!shipment) {
    return <EmptyOrderOverview data={data} />;
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
              <OrderOverview order={shipment} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-auto p-4" value="products">
              <OrderOverview order={shipment} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-auto p-4" value="alerts">
              <LowStockProducts products={data.low_stock_products} />
            </TabsContent>
            <TabsContent className="min-h-0 overflow-auto p-4" value="activity">
              <Activity data={data} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
