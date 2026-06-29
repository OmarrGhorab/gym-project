import { serverApiFetch } from "@/lib/api/server";

import { emptyInventoryLogisticsData, type InventoryLogisticsData, type InventoryProduct } from "./shipment-data";

type ProductsResponse = InventoryProduct[] | { data: InventoryProduct[] };

function unwrapProducts(result: ProductsResponse): InventoryProduct[] {
  return Array.isArray(result) ? result : result.data;
}

export async function getInventoryLogisticsData(): Promise<InventoryLogisticsData> {
  try {
    const [summaryResult, productsResult] = await Promise.all([
      serverApiFetch<InventoryLogisticsData>("/reports/inventory-logistics"),
      serverApiFetch<ProductsResponse>("/products?sort=name&per_page=100"),
    ]);

    return {
      ...summaryResult.data,
      products: unwrapProducts(productsResult.data),
    };
  } catch {
    return emptyInventoryLogisticsData;
  }
}
