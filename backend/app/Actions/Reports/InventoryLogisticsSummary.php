<?php

namespace App\Actions\Reports;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\PurchaseOrder;
use Carbon\CarbonImmutable;

final class InventoryLogisticsSummary
{
    /**
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        $now = CarbonImmutable::now();
        $products = Product::query()->active();
        $totalProducts = (clone $products)->count();
        $lowStockProducts = (clone $products)->lowStock()->count();
        $outOfStockProducts = (clone $products)->where('stock_quantity', '<=', 0)->count();
        $ordered = PurchaseOrder::query()->whereIn('status', ['ordered', 'partial', 'delayed'])->count();
        $receivedThisMonth = PurchaseOrder::query()
            ->where('status', 'received')
            ->whereBetween('received_at', [$now->startOfMonth(), $now->endOfMonth()])
            ->count();

        return [
            'generated_at' => $now->toIso8601String(),
            'stats' => [
                'products_total' => $totalProducts,
                'low_stock_products' => $lowStockProducts,
                'out_of_stock_products' => $outOfStockProducts,
                'open_purchase_orders' => $ordered,
                'received_this_month' => $receivedThisMonth,
                'inventory_value' => number_format((float) (clone $products)->selectRaw('SUM(stock_quantity * cost) as value')->value('value'), 2, '.', ''),
            ],
            'purchase_orders' => $this->purchaseOrders(),
            'low_stock_products' => $this->lowStockProducts(),
            'recent_movements' => $this->recentMovements(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function purchaseOrders(): array
    {
        return PurchaseOrder::query()
            ->with(['items.product', 'creator', 'receiver'])
            ->latest()
            ->limit(20)
            ->get()
            ->map(function (PurchaseOrder $order): array {
                $firstItem = $order->items->first();
                $itemsCount = $order->items->count();
                $orderedUnits = $order->items->sum('quantity_ordered');
                $receivedUnits = $order->items->sum('quantity_received');
                $progress = $orderedUnits > 0 ? (int) round(($receivedUnits / $orderedUnits) * 100) : 0;

                return [
                    'id' => $order->id,
                    'reference' => $order->reference,
                    'supplier_name' => $order->supplier_name,
                    'supplier_phone' => $order->supplier_phone,
                    'ordered_at' => $order->ordered_at?->toDateString(),
                    'expected_at' => $order->expected_at?->toDateString(),
                    'received_at' => $order->received_at?->toIso8601String(),
                    'status' => $this->computedStatus($order),
                    'subtotal' => $order->subtotal,
                    'notes' => $order->notes,
                    'image' => $order->image,
                    'creator_name' => $order->creator?->name,
                    'receiver_name' => $order->receiver?->name,
                    'items_count' => $itemsCount,
                    'ordered_units' => $orderedUnits,
                    'received_units' => $receivedUnits,
                    'progress' => $progress,
                    'primary_product' => $firstItem?->product ? $this->productPayload($firstItem->product) : null,
                    'items' => $order->items->map(fn ($item): array => [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'quantity_ordered' => $item->quantity_ordered,
                        'quantity_received' => $item->quantity_received,
                        'unit_cost' => $item->unit_cost,
                        'line_total' => $item->line_total,
                        'product' => $item->product ? $this->productPayload($item->product) : null,
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function lowStockProducts(): array
    {
        return Product::query()
            ->active()
            ->lowStock()
            ->orderBy('stock_quantity')
            ->limit(12)
            ->get()
            ->map(fn (Product $product): array => $this->productPayload($product))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentMovements(): array
    {
        return InventoryMovement::query()
            ->with(['product', 'createdBy:id,name'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (InventoryMovement $movement): array => [
                'id' => $movement->id,
                'type' => $movement->type,
                'quantity' => $movement->quantity,
                'reason' => $movement->reason,
                'created_at' => $movement->created_at?->toIso8601String(),
                'product' => $movement->product ? $this->productPayload($movement->product) : null,
                'creator' => $movement->createdBy?->name,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function productPayload(Product $product): array
    {
        return [
            'id' => $product->id,
            'name' => $product->name,
            'category' => $product->category,
            'sku' => $product->sku,
            'price' => $product->price,
            'cost' => $product->cost,
            'stock_quantity' => $product->stock_quantity,
            'low_stock_threshold' => $product->low_stock_threshold,
            'image_url' => $product->image ? url("/api/v1/products/{$product->id}/image") : null,
            'is_low_stock' => $product->is_low_stock,
        ];
    }

    private function computedStatus(PurchaseOrder $order): string
    {
        if ($order->status === 'ordered' && $order->expected_at && $order->expected_at->isPast()) {
            return 'delayed';
        }

        return $order->status;
    }
}
