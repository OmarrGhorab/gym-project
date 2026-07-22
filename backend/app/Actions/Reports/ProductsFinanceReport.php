<?php

namespace App\Actions\Reports;

use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;

final class ProductsFinanceReport
{
    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $from = Carbon::parse($params['from'] ?? now()->startOfMonth()->toDateString())->startOfDay();
        $to = Carbon::parse($params['to'] ?? now()->toDateString())->endOfDay();
        $category = $params['category'] ?? null;
        $search = $params['search'] ?? null;
        $paymentMethod = $params['payment_method'] ?? null;

        $productsQuery = Product::query()
            ->when($category, fn ($q) => $q->where('category', $category))
            ->when($search, fn ($q) => $q->where('name', 'like', "%{$search}%"));

        $products = $productsQuery->get();

        $productsTable = $products->map(function (Product $product) use ($from, $to, $paymentMethod): array {
            $salesItemsQuery = SaleItem::query()
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->where('sale_items.product_id', $product->id)
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$from, $to])
                ->when($paymentMethod, fn ($q) => $q->where('sales.payment_method', $paymentMethod));

            $unitsSold = (int) (clone $salesItemsQuery)->sum('sale_items.quantity');
            $revenue = (float) (clone $salesItemsQuery)->sum('sale_items.total');

            return [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'sku' => $product->sku,
                'price' => number_format((float) $product->price, 2, '.', ''),
                'cost' => number_format((float) $product->cost, 2, '.', ''),
                'stock_quantity' => $product->stock_quantity,
                'low_stock_threshold' => $product->low_stock_threshold,
                'units_sold_period' => $unitsSold,
                'revenue_period' => number_format($revenue, 2, '.', ''),
                'status' => $product->stock_quantity <= 0 ? 'out_of_stock' : ($product->stock_quantity <= $product->low_stock_threshold ? 'low_stock' : 'in_stock'),
            ];
        })->values()->all();

        $salesQuery = Sale::query()
            ->with(['items.product', 'member:id,name', 'soldBy:id,name'])
            ->completed()
            ->when(isset($params['from']) && isset($params['to']), fn ($q) => $q->whereBetween('created_at', [$from, $to]))
            ->when($paymentMethod, fn ($q) => $q->where('payment_method', $paymentMethod))
            ->latest();

        if ($salesQuery->count() === 0 && ! $paymentMethod) {
            $salesQuery = Sale::query()
                ->with(['items.product', 'member:id,name', 'soldBy:id,name'])
                ->completed()
                ->latest();
        }

        $totalRevenue = (float) (clone $salesQuery)->sum('total');
        $totalOrders = (clone $salesQuery)->count();
        $totalUnitsSold = (int) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.created_at', [$from, $to])
            ->sum('sale_items.quantity');

        $lowStockCount = Product::query()->lowStock()->count();

        $transactions = $salesQuery->limit(100)->get()->map(fn (Sale $sale): array => [
            'id' => '#'.$sale->id,
            'customer_name' => $sale->member?->name ?? 'Walk-in Customer',
            'seller_name' => $sale->soldBy?->name ?? 'Unknown Staff',
            'payment_method' => $sale->payment_method,
            'items_count' => $sale->items->sum('quantity'),
            'total_amount' => number_format((float) $sale->total, 2, '.', ''),
            'created_at' => $sale->created_at?->toIso8601String(),
        ])->values()->all();

        return [
            'totals' => [
                'total_pos_revenue' => number_format($totalRevenue, 2, '.', ''),
                'total_orders' => $totalOrders,
                'total_units_sold' => $totalUnitsSold,
                'low_stock_products_count' => $lowStockCount,
            ],
            'products_summary' => $productsTable,
            'transactions' => $transactions,
        ];
    }
}
