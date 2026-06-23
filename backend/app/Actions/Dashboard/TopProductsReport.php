<?php

namespace App\Actions\Dashboard;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class TopProductsReport
{
    /** @param int $limit @param string $period */
    public function execute(int $limit = 5, string $period = 'week'): array
    {
        $startDate = match ($period) {
            'today' => Carbon::now()->startOfDay(),
            'week' => Carbon::now()->subDays(7)->startOfDay(),
            'month' => Carbon::now()->subDays(30)->startOfDay(),
        };

        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'completed')
            ->where('sales.created_at', '>=', $startDate)
            ->groupBy('sale_items.product_id', 'products.name', 'products.sku')
            ->selectRaw('
                sale_items.product_id,
                products.name as name,
                products.sku as sku,
                SUM(sale_items.total) as revenue,
                CAST(SUM(sale_items.quantity) AS SIGNED) as units_sold
            ')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get()
            ->map(function ($product) {
                $product->revenue = number_format((float) $product->revenue, 2, '.', '');

                return $product;
            })
            ->toArray();
    }
}
