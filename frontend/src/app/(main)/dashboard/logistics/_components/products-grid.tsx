"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import { ProductQuickActions } from "./logistics-actions";
import { ProductImage } from "./product-image";
import type { InventoryProduct } from "./shipment-data";

export function ProductsGrid({ products, emptyMessage }: { products: InventoryProduct[]; emptyMessage?: string }) {
  const t = useTranslations("Dashboard.logistics");

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {products.length === 0 ? (
        <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          {emptyMessage ?? t("noLowStock")}
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
