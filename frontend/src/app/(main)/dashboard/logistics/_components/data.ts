import { serverApiFetch } from "@/lib/api/server";

import {
  emptyInventoryLogisticsData,
  type InventoryLogisticsData,
  type InventoryProduct,
  type PaginationMeta,
  type ProductFilters,
} from "./shipment-data";

const DEFAULT_PER_PAGE = 15;

function normalizeProductsMeta(meta: unknown): PaginationMeta {
  const safe = meta as Partial<PaginationMeta> | undefined;

  return {
    current_page: safe?.current_page ?? 1,
    per_page: safe?.per_page ?? DEFAULT_PER_PAGE,
    total: safe?.total ?? 0,
    last_page: safe?.last_page ?? 1,
  };
}

function buildProductsQuery(page: number, perPage: number, filters: ProductFilters = {}): string {
  const params = new URLSearchParams();

  params.set("sort", "name");
  params.set("per_page", String(perPage));
  params.set("page", String(page));

  if (filters.search?.trim()) {
    params.set("filter[search]", filters.search.trim());
  }

  if (filters.status && filters.status !== "all") {
    params.set("filter[is_active]", filters.status === "active" ? "1" : "0");
  }

  if (filters.stock === "low") {
    params.set("filter[is_low_stock]", "1");
  }

  if (filters.category && filters.category !== "all") {
    params.set("filter[category]", filters.category);
  }

  return `/products?${params.toString()}`;
}

export async function getInventoryLogisticsData(
  page = 1,
  filters: ProductFilters = {},
): Promise<InventoryLogisticsData> {
  try {
    const [summaryResult, productsResult] = await Promise.all([
      serverApiFetch<InventoryLogisticsData>("/reports/inventory-logistics"),
      serverApiFetch<InventoryProduct[]>(buildProductsQuery(page, DEFAULT_PER_PAGE, filters)),
    ]);

    return {
      ...summaryResult.data,
      products: productsResult.data ?? [],
      products_meta: normalizeProductsMeta(productsResult.meta),
    };
  } catch {
    return emptyInventoryLogisticsData;
  }
}
