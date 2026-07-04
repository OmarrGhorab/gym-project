export type InventoryProduct = {
  id: number;
  name: string;
  category: string;
  sku: string;
  price: string;
  cost: string;
  stock_quantity: number;
  low_stock_threshold: number;
  image_url: string | null;
  is_low_stock: boolean;
};

export type PurchaseOrderItem = {
  id: number;
  product_id: number;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: string;
  line_total: string;
  product: InventoryProduct | null;
};

export type PurchaseOrder = {
  id: number;
  reference: string;
  supplier_name: string;
  supplier_phone: string | null;
  ordered_at: string | null;
  expected_at: string | null;
  received_at: string | null;
  status: "cancelled" | "delayed" | "draft" | "ordered" | "partial" | "received";
  subtotal: string;
  notes: string | null;
  image: string | null;
  image_url: string | null;
  items_count: number;
  ordered_units: number;
  received_units: number;
  progress: number;
  primary_product: InventoryProduct | null;
  items: PurchaseOrderItem[];
};

export type InventoryMovement = {
  id: number;
  type: string;
  quantity: number;
  reason: string;
  created_at: string | null;
  product: InventoryProduct | null;
  creator: string | null;
};

export type ProductFilters = {
  search?: string;
  status?: "all" | "active" | "inactive";
  stock?: "all" | "low";
  category?: "all" | string;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type InventoryLogisticsData = {
  generated_at: string;
  stats: {
    products_total: number;
    low_stock_products: number;
    out_of_stock_products: number;
    open_purchase_orders: number;
    received_this_month: number;
    inventory_value: string;
  };
  purchase_orders: PurchaseOrder[];
  low_stock_products: InventoryProduct[];
  products: InventoryProduct[];
  products_meta: PaginationMeta;
  recent_movements: InventoryMovement[];
};

export const emptyInventoryLogisticsData: InventoryLogisticsData = {
  generated_at: new Date().toISOString(),
  stats: {
    inventory_value: "0.00",
    low_stock_products: 0,
    open_purchase_orders: 0,
    out_of_stock_products: 0,
    products_total: 0,
    received_this_month: 0,
  },
  low_stock_products: [],
  products: [],
  products_meta: {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  },
  purchase_orders: [],
  recent_movements: [],
};

export function getProductImageSrc(product: InventoryProduct | null | undefined) {
  if (!product?.image_url) return null;

  return `/api/media/products/${product.id}/image?v=${encodeURIComponent(product.image_url)}`;
}

export function getPurchaseOrderImageSrc(order: PurchaseOrder | null | undefined) {
  if (!order?.image_url) return null;

  return `/api/media/purchase-orders/${order.id}/image?v=${encodeURIComponent(order.image_url)}`;
}
