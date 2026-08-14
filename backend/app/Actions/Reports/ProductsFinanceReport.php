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
        $productId = isset($params['product_id']) ? (int) $params['product_id'] : null;

        $productsQuery = Product::query()
            ->when($category, fn ($q) => $q->where('category', $category))
            ->when($search, fn ($q) => $q->where('name', 'like', "%{$search}%"));

        $products = $productsQuery->get();

        $productStats = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.created_at', [$from, $to])
            ->when($paymentMethod, fn ($q) => $q->where('sales.payment_method', $paymentMethod))
            ->whereIn('sale_items.product_id', $products->pluck('id'))
            ->groupBy('sale_items.product_id')
            ->selectRaw('sale_items.product_id as product_id, SUM(sale_items.quantity) as units, SUM(sale_items.total) as revenue, COALESCE(SUM(sale_items.total - (sales.discount * sale_items.total / NULLIF(sales.subtotal, 0))), 0) as net_revenue')
            ->get()
            ->keyBy('product_id');

        $productsTable = $products->map(function (Product $product) use ($productStats): array {
            $stats = $productStats->get($product->id);

            $unitsSold = (int) ($stats->units ?? 0);
            $revenue = (float) ($stats->revenue ?? 0);
            $netRevenue = (float) ($stats->net_revenue ?? 0);
            $unitProfit = (float) $product->price - (float) $product->cost;
            $netProfit = $netRevenue - ((float) $product->cost * $unitsSold);

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
                'net_revenue_period' => number_format($netRevenue, 2, '.', ''),
                'unit_profit' => number_format($unitProfit, 2, '.', ''),
                'net_profit_period' => number_format($netProfit, 2, '.', ''),
                'status' => $product->stock_quantity <= 0 ? 'out_of_stock' : ($product->stock_quantity <= $product->low_stock_threshold ? 'low_stock' : 'in_stock'),
            ];
        })->values()->all();

        $salesQuery = Sale::query()
            ->with(['items.product', 'member:id,name', 'soldBy:id,name'])
            ->completed()
            ->when(isset($params['from']) && isset($params['to']), fn ($q) => $q->whereBetween('created_at', [$from, $to]))
            ->when($paymentMethod, fn ($q) => $q->where('payment_method', $paymentMethod))
            ->latest();

        if ($salesQuery->count() === 0 && ! $paymentMethod && ! isset($params['from'], $params['to'])) {
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
            'product_sales' => $productId
                ? $this->productSales($productId, $from, $to, $paymentMethod)
                : [],
            'transactions' => $transactions,
        ];
    }

    /**
     * @return list<array<string, int|string|null>>
     */
    private function productSales(int $productId, Carbon $from, Carbon $to, ?string $paymentMethod): array
    {
        $productCost = (float) Product::query()->findOrFail($productId)->cost;

        return SaleItem::query()
            ->with([
                'sale.member:id,name,phone,email,attendance_code',
                'sale.soldBy:id,name',
            ])
            ->where('product_id', $productId)
            ->whereHas('sale', function ($query) use ($from, $to, $paymentMethod): void {
                $query
                    ->completed()
                    ->whereBetween('created_at', [$from, $to])
                    ->when($paymentMethod, fn ($sales) => $sales->where('payment_method', $paymentMethod));
            })
            ->latest('id')
            ->get()
            ->map(function (SaleItem $item) use ($productCost): array {
                $sale = $item->sale;
                $lineSubtotal = (float) $item->total;
                $saleSubtotal = (float) ($sale?->subtotal ?? 0);
                $discountShare = $saleSubtotal > 0
                    ? ((float) ($sale?->discount ?? 0) * ($lineSubtotal / $saleSubtotal))
                    : 0;
                $netReceived = max(0, $lineSubtotal - $discountShare);
                $lineCost = $productCost * $item->quantity;

                return [
                    'sale_id' => $sale?->id,
                    'sold_at' => $sale?->created_at?->toDateTimeString(),
                    'member_name' => $sale?->member?->name,
                    'member_phone' => $sale?->member?->phone,
                    'member_email' => $sale?->member?->email,
                    'member_code' => $sale?->member?->attendance_code,
                    'seller_name' => $sale?->soldBy?->name,
                    'quantity' => $item->quantity,
                    'unit_price' => number_format((float) $item->unit_price, 2, '.', ''),
                    'line_subtotal' => number_format($lineSubtotal, 2, '.', ''),
                    'order_discount' => number_format((float) ($sale?->discount ?? 0), 2, '.', ''),
                    'allocated_discount' => number_format($discountShare, 2, '.', ''),
                    'net_received' => number_format($netReceived, 2, '.', ''),
                    'unit_cost' => number_format($productCost, 2, '.', ''),
                    'net_profit' => number_format($netReceived - $lineCost, 2, '.', ''),
                    'payment_method' => $sale?->payment_method,
                ];
            })
            ->all();
    }
}
