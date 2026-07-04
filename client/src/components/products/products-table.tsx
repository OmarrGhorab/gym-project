"use client";

import * as React from "react";
import { Edit3, Loader2, PackagePlus, Power, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { deleteProduct, toggleProduct } from "@/lib/actions/products";
import type { Product } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

export function ProductsTable({
  products,
  onEdit,
  onAdjustStock,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("ProductsPage");
  const isArabic = locale === "ar";

  const columns = React.useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("tableProduct"),
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse text-right")}>
              <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/15 text-xs font-black text-primary">
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getProductImageSrc(product)}
                    alt=""
                    className="size-full rounded-lg object-cover"
                  />
                ) : (
                  product.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{product.name}</p>
                <p className="text-xs font-semibold text-muted-foreground">{product.sku}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "category",
        header: t("tableCategory"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground">
            {row.original.category}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: t("tablePrice"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.price, locale)}
          </span>
        ),
      },
      {
        accessorKey: "cost",
        header: t("tableCost"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatCurrency(row.original.cost, locale)}
          </span>
        ),
      },
      {
        accessorKey: "stock_quantity",
        header: t("tableStock"),
        cell: ({ row }) => (
          <div>
            <p className={cn("text-sm font-black tabular-nums", row.original.is_low_stock ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
              {row.original.stock_quantity.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("threshold", { count: row.original.low_stock_threshold })}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("tableStatus"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <Badge
              variant="outline"
              className={cn("w-fit rounded-md border px-2 py-0.5 text-xs font-bold", row.original.is_active ? activeClass : inactiveClass)}
            >
              {row.original.is_active ? t("statusActive") : t("statusInactive")}
            </Badge>
            {row.original.is_low_stock && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {t("stockLow")}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableActions")}
          </span>
        ),
        cell: ({ row }) => (
          <ProductActions
            product={row.original}
            onEdit={onEdit}
            onAdjustStock={onAdjustStock}
          />
        ),
      },
    ],
    [isArabic, locale, onAdjustStock, onEdit, t]
  );

  return <DataTable columns={columns} data={products} emptyMessage={t("empty")} isArabic={isArabic} />;
}

function ProductActions({
  product,
  onEdit,
  onAdjustStock,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("ProductsPage");
  const [isPending, setIsPending] = React.useState(false);

  async function handleToggle() {
    setIsPending(true);
    try {
      await toggleProduct(product.id, locale as AppLocale);
      toast.success(product.is_active ? t("productDisabledSuccess") : t("productEnabledSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(t("deleteConfirm", { name: product.name }));
    if (!confirmed) return;

    setIsPending(true);
    try {
      await deleteProduct(product.id, locale as AppLocale);
      toast.success(t("productDeletedSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionEdit")} onClick={() => onEdit(product)}>
        <Edit3 className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionStock")} onClick={() => onAdjustStock(product)}>
        <PackagePlus className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title={product.is_active ? t("actionDisable") : t("actionEnable")} onClick={handleToggle} disabled={isPending}>
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionDelete")} onClick={handleDelete} disabled={isPending}>
        <Trash2 className="size-3.5" />
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

function getProductImageSrc(product: Product) {
  const version = product.updated_at ? `?v=${encodeURIComponent(product.updated_at)}` : "";
  return `/api/media/products/${product.id}/image${version}`;
}

const activeClass = "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
const inactiveClass = "border-slate-500/20 bg-slate-500/15 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";
