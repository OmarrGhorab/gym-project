"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { getProductsPage } from "./actions";
import { ProductsGrid } from "./products-grid";
import type { InventoryLogisticsData, InventoryProduct, PaginationMeta, ProductFilters } from "./shipment-data";

type ProductsTabProps = {
  data: InventoryLogisticsData;
};

function useProductCategories(products: InventoryProduct[]) {
  return React.useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );
}

export function ProductsTab({ data }: ProductsTabProps) {
  const t = useTranslations("Dashboard.logistics");
  const categories = useProductCategories(data.products);

  const [products, setProducts] = React.useState<InventoryProduct[]>(data.products);
  const [meta, setMeta] = React.useState<PaginationMeta>(data.products_meta);
  const [page, setPage] = React.useState(data.products_meta.current_page);
  const [isPending, setIsPending] = React.useState(false);

  const [filters, setFilters] = React.useState<ProductFilters>({
    category: "all",
    search: "",
    status: "all",
    stock: "all",
  });
  const [searchInput, setSearchInput] = React.useState("");

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;

    if (filters.search) count += 1;
    if (filters.status && filters.status !== "all") count += 1;
    if (filters.stock && filters.stock !== "all") count += 1;
    if (filters.category && filters.category !== "all") count += 1;

    return count;
  }, [filters]);

  const lastGeneratedRef = React.useRef(data.generated_at);

  React.useEffect(() => {
    if (data.generated_at === lastGeneratedRef.current) {
      return;
    }
    lastGeneratedRef.current = data.generated_at;

    const hasFilters = activeFiltersCount > 0 || page > 1;

    if (!hasFilters) {
      setProducts(data.products);
      setMeta(data.products_meta);
      setPage(data.products_meta.current_page);
    } else {
      let cancelled = false;
      async function refetch() {
        setIsPending(true);
        try {
          const result = await getProductsPage(page, meta.per_page, filters);
          if (!cancelled) {
            setProducts(result.products);
            setMeta(result.meta);
            setPage(result.meta.current_page);
          }
        } catch {
          // Keep current state
        } finally {
          if (!cancelled) {
            setIsPending(false);
          }
        }
      }
      void refetch();
      return () => {
        cancelled = true;
      };
    }
  }, [data, page, meta.per_page, filters, activeFiltersCount]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((previous) => (previous.search === searchInput ? previous : { ...previous, search: searchInput }));
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchFiltered() {
      setIsPending(true);

      try {
        const result = await getProductsPage(1, meta.per_page, filters);

        if (!cancelled) {
          setProducts(result.products);
          setMeta(result.meta);
          setPage(result.meta.current_page);
        }
      } catch {
        // Keep current state on error.
      } finally {
        if (!cancelled) {
          setIsPending(false);
        }
      }
    }

    void fetchFiltered();

    return () => {
      cancelled = true;
    };
  }, [filters, meta.per_page]);

  async function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > meta.last_page || nextPage === page || isPending) {
      return;
    }

    setIsPending(true);

    try {
      const result = await getProductsPage(nextPage, meta.per_page, filters);
      setProducts(result.products);
      setMeta(result.meta);
      setPage(result.meta.current_page);
    } catch {
      // Keep current page on error.
    } finally {
      setIsPending(false);
    }
  }

  function updateFilter<Key extends keyof ProductFilters>(key: Key, value: ProductFilters[Key]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters() {
    setSearchInput("");
    setFilters({
      category: "all",
      search: "",
      status: "all",
      stock: "all",
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">{t("products")}</h3>
          <p className="text-muted-foreground text-xs">{t("summaryDescription")}</p>
        </div>
        <Badge variant="outline">{t("itemCount", { count: meta.total })}</Badge>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("searchProducts")}
            className="h-8 pl-9"
            placeholder={t("searchProductPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <SelectFilter
            label={t("statusFilter")}
            value={filters.status ?? "all"}
            onValueChange={(value) => updateFilter("status", (value as ProductFilters["status"] | null) ?? "all")}
            options={[
              { label: t("filterAll"), value: "all" },
              { label: t("filterActive"), value: "active" },
              { label: t("filterInactive"), value: "inactive" },
            ]}
          />
          <SelectFilter
            label={t("stockFilter")}
            value={filters.stock ?? "all"}
            onValueChange={(value) => updateFilter("stock", (value as ProductFilters["stock"] | null) ?? "all")}
            options={[
              { label: t("filterAll"), value: "all" },
              { label: t("filterLowStock"), value: "low" },
            ]}
          />
          {categories.length > 0 && (
            <SelectFilter
              label={t("categoryFilter")}
              value={filters.category ?? "all"}
              onValueChange={(value) => updateFilter("category", value ?? "all")}
              options={[
                { label: t("filterAll"), value: "all" },
                ...categories.map((category) => ({ label: category, value: category })),
              ]}
            />
          )}
          {activeFiltersCount > 0 && (
            <Button className="h-8 gap-1.5" size="sm" type="button" variant="ghost" onClick={clearFilters}>
              <X className="size-3.5" />
              {t("clearFilters")}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <ProductsGrid products={products} emptyMessage={t("noProducts")} />
      </div>

      {meta.last_page > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-muted-foreground text-xs">{t("pageInfo", { page, lastPage: meta.last_page })}</p>
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={page <= 1 || isPending}
              onClick={() => goToPage(page - 1)}
              aria-label={t("previousPage")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={page >= meta.last_page || isPending}
              onClick={() => goToPage(page + 1)}
              aria-label={t("nextPage")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectFilter({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onValueChange: (value: string | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="font-medium text-muted-foreground text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 min-w-32 text-xs">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
