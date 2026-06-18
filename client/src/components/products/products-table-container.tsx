"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductsTable } from "@/components/products/products-table";
import { StockAdjustDialog } from "@/components/products/stock-adjust-dialog";
import type { Product } from "@/lib/api/dashboard";

export function ProductsTableContainer({ products }: { products: Product[] }) {
  const router = useRouter();
  const t = useTranslations("ProductsPage");
  const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isStockOpen, setIsStockOpen] = React.useState(false);

  function openAddDialog() {
    setDialogMode("add");
    setSelectedProduct(null);
    setIsFormOpen(true);
  }

  function openEditDialog(product: Product) {
    setDialogMode("edit");
    setSelectedProduct(product);
    setIsFormOpen(true);
  }

  function openStockDialog(product: Product) {
    setSelectedProduct(product);
    setIsStockOpen(true);
  }

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Button type="button" size="sm" onClick={openAddDialog}>
          <Plus className="size-4" />
          {t("addButton")}
        </Button>
      </div>

      <ProductsTable
        products={products}
        onEdit={openEditDialog}
        onAdjustStock={openStockDialog}
      />

      <ProductFormDialog
        mode={dialogMode}
        product={selectedProduct}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleSuccess}
      />
      <StockAdjustDialog
        product={selectedProduct}
        open={isStockOpen}
        onOpenChange={setIsStockOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
