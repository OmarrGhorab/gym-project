"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";

import { AlertTriangle, Boxes, PackageCheck, PackageSearch, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { RecordExpenseDialog } from "../../finance/_components/record-expense-dialog";
import {
  AddProductDialog,
  CreatePurchaseOrderDialog,
  type ProductActionPermissions,
  ProductQuickActions,
} from "./logistics-actions";
import type { InventoryLogisticsData, PurchaseOrder } from "./shipment-data";
import { ShipmentDetails } from "./shipment-details";
import { ShipmentList } from "./shipment-list";

function formatEgp(value: string | number) {
  return new Intl.NumberFormat("en-EG", {
    currency: "EGP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value) || 0);
}

function InventorySummarySheet({
  canRecordExpense,
  data,
  open,
  onOpenChange,
  productPermissions,
}: {
  canRecordExpense: boolean;
  data: InventoryLogisticsData;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  productPermissions: ProductActionPermissions;
}) {
  const t = useTranslations("Dashboard.logistics");
  const stats = [
    { icon: Boxes, label: t("products"), value: data.stats.products_total },
    { icon: AlertTriangle, label: t("lowStock"), value: data.stats.low_stock_products },
    { icon: PackageSearch, label: t("outOfStock"), value: data.stats.out_of_stock_products },
    { icon: ReceiptText, label: t("openPo"), value: data.stats.open_purchase_orders },
    { icon: PackageCheck, label: t("received"), value: data.stats.received_this_month },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("inventorySummary")}</SheetTitle>
          <SheetDescription>{t("summaryDescription")}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="grid size-8 place-items-center rounded-md bg-muted">
                    <stat.icon className="size-4" />
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{stat.label}</div>
                    <div className="font-medium text-lg leading-none">{stat.value}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{t("inventoryValue")}</div>
              <div className="text-2xl tracking-tight">{formatEgp(data.stats.inventory_value)}</div>
            </CardContent>
          </Card>

          {productPermissions.canCreateProduct || productPermissions.canAdjustInventory || canRecordExpense ? (
            <div className="grid grid-cols-2 gap-2">
              {productPermissions.canCreateProduct ? (
                <AddProductDialog categories={data.products.map((product) => product.category)} />
              ) : null}
              {productPermissions.canAdjustInventory ? <CreatePurchaseOrderDialog products={data.products} /> : null}
              {canRecordExpense ? <RecordExpenseDialog /> : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="font-medium text-sm">{t("lowStockProducts")}</div>
            {data.low_stock_products.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
                {t("noLowStock")}
              </div>
            ) : (
              data.low_stock_products.slice(0, 8).map((product) => (
                <div key={product.id} className="grid gap-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">{product.name}</div>
                      <div className="truncate text-muted-foreground text-xs">
                        {product.category} • {t("threshold", { value: product.low_stock_threshold })}
                      </div>
                    </div>
                    <Badge variant={product.stock_quantity <= 0 ? "destructive" : "outline"}>
                      {t("left", { count: product.stock_quantity })}
                    </Badge>
                  </div>
                  <ProductQuickActions product={product} compact permissions={productPermissions} />
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <div className="font-medium text-sm">{t("recentActivity")}</div>
            {data.recent_movements.slice(0, 5).map((movement) => (
              <div key={movement.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{movement.product?.name ?? t("product")}</div>
                  <div className="truncate text-muted-foreground text-xs">{movement.reason}</div>
                </div>
                <Badge variant={movement.quantity < 0 ? "destructive" : "outline"}>
                  {movement.quantity > 0 ? "+" : ""}
                  {movement.quantity}
                </Badge>
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Logistics({
  canRecordExpense,
  data,
  productPermissions,
}: {
  canRecordExpense: boolean;
  data: InventoryLogisticsData;
  productPermissions: ProductActionPermissions;
}) {
  const t = useTranslations("Dashboard.logistics");
  const searchParams = useSearchParams();
  const productsRequested = searchParams.get("tab") === "products";
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = React.useState<PurchaseOrder["id"] | null>(
    data.purchase_orders.length > 0 ? data.purchase_orders[0].id : null,
  );
  const selectedShipment =
    data.purchase_orders.find((shipment) => shipment.id === selectedShipmentId) ??
    (data.purchase_orders.length > 0 ? data.purchase_orders[0] : null);
  const canShowProductHeaderActions =
    productPermissions.canCreateProduct || productPermissions.canAdjustInventory || canRecordExpense;

  // The details pane is desktop-only, so `?tab=products` has to open it as a sheet on mobile.
  React.useEffect(() => {
    if (productsRequested && window.innerWidth < 1024) {
      setDetailsOpen(true);
    }
  }, [productsRequested]);

  function handleSelectShipment(shipmentId: PurchaseOrder["id"]) {
    setSelectedShipmentId(shipmentId);

    if (window.innerWidth < 1024) {
      setDetailsOpen(true);
    }
  }

  return (
    <>
      <div
        data-content-padding="false"
        className="grid h-[calc(100dvh-var(--dashboard-header-height))] overflow-hidden lg:grid-cols-[400px_minmax(0,1fr)] lg:divide-x"
      >
        <div className="h-full overflow-hidden">
          <ShipmentList
            data={data}
            selectedShipmentId={selectedShipmentId}
            onOpenSummary={() => setSummaryOpen(true)}
            onSelectShipment={handleSelectShipment}
          />
        </div>
        <div className="hidden h-full overflow-hidden lg:block">
          <div className="flex h-full min-h-0 flex-col">
            {canShowProductHeaderActions ? (
              <div className="flex items-center justify-end gap-2 border-b p-3">
                {productPermissions.canCreateProduct ? (
                  <AddProductDialog categories={data.products.map((product) => product.category)} />
                ) : null}
                {productPermissions.canAdjustInventory ? <CreatePurchaseOrderDialog products={data.products} /> : null}
                {canRecordExpense ? <RecordExpenseDialog /> : null}
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              <ShipmentDetails
                data={data}
                defaultTab={productsRequested ? "products" : "overview"}
                shipment={selectedShipment}
                permissions={productPermissions}
              />
            </div>
          </div>
        </div>
      </div>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-3/4"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              {selectedShipment
                ? t("purchaseOrderTitle", { reference: selectedShipment.reference })
                : t("purchaseOrderDetails")}
            </SheetTitle>
            <SheetDescription>{t("purchaseOrderDescription")}</SheetDescription>
          </SheetHeader>
          <ShipmentDetails
            data={data}
            defaultTab={productsRequested ? "products" : "overview"}
            shipment={selectedShipment}
            permissions={productPermissions}
          />
        </SheetContent>
      </Sheet>

      <InventorySummarySheet
        data={data}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        productPermissions={productPermissions}
        canRecordExpense={canRecordExpense}
      />
    </>
  );
}
