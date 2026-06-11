<?php

namespace App\Actions\Reports;

use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

class PeriodSalesReport
{
    /**
     * Generate period sales report.
     *
     * @param  array<string, mixed>  $filters
     */
    public function execute(array $filters): CursorPaginator
    {
        $from = $filters['from'];
        $to = $filters['to'];
        $groupBy = $filters['group_by'];
        $productId = $filters['product_id'] ?? null;
        $cashierId = $filters['cashier_id'] ?? null;

        if ($groupBy === 'product') {
            $query = DB::table('sale_items')
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->join('products', 'products.id', '=', 'sale_items.product_id')
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$from.' 00:00:00', $to.' 23:59:59']);

            if ($productId) {
                $query->where('sale_items.product_id', $productId);
            }
            if ($cashierId) {
                $query->where('sales.sold_by_user_id', $cashierId);
            }

            $query->groupBy('sale_items.product_id', 'products.name', 'products.sku')
                ->selectRaw('
                    sale_items.product_id,
                    products.name as product_name,
                    products.sku as product_sku,
                    SUM(sale_items.total) as revenue,
                    CAST(SUM(sale_items.quantity) AS SIGNED) as units_sold,
                    COUNT(DISTINCT sales.id) as sales_count
                ')
                ->orderBy('sale_items.product_id');
        } elseif ($groupBy === 'cashier') {
            $query = DB::table('sales')
                ->join('users', 'users.id', '=', 'sales.sold_by_user_id')
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$from.' 00:00:00', $to.' 23:59:59']);

            if ($cashierId) {
                $query->where('sales.sold_by_user_id', $cashierId);
            }
            if ($productId) {
                $query->whereExists(function ($q) use ($productId): void {
                    $q->select(DB::raw(1))
                        ->from('sale_items')
                        ->whereColumn('sale_items.sale_id', 'sales.id')
                        ->where('sale_items.product_id', $productId);
                });
            }

            $query->groupBy('sales.sold_by_user_id', 'users.name')
                ->selectRaw('
                    sales.sold_by_user_id,
                    users.name as cashier_name,
                    SUM(sales.total) as revenue,
                    COUNT(sales.id) as sales_count,
                    CAST(SUM((select SUM(quantity) from sale_items where sale_id = sales.id)) AS SIGNED) as units_sold
                ')
                ->orderBy('sales.sold_by_user_id');
        } else { // day
            $query = DB::table('sales')
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$from.' 00:00:00', $to.' 23:59:59']);

            if ($cashierId) {
                $query->where('sales.sold_by_user_id', $cashierId);
            }
            if ($productId) {
                $query->whereExists(function ($q) use ($productId): void {
                    $q->select(DB::raw(1))
                        ->from('sale_items')
                        ->whereColumn('sale_items.sale_id', 'sales.id')
                        ->where('sale_items.product_id', $productId);
                });
            }

            $query->groupBy(DB::raw('DATE(sales.created_at)'))
                ->selectRaw('
                    DATE(sales.created_at) as date,
                    SUM(sales.total) as revenue,
                    COUNT(sales.id) as sales_count,
                    CAST(SUM((select SUM(quantity) from sale_items where sale_id = sales.id)) AS SIGNED) as units_sold
                ')
                ->orderBy('date', 'desc');
        }

        return $query->cursorPaginate(50)->through(function ($item) {
            if (isset($item->revenue)) {
                $item->revenue = number_format((float) $item->revenue, 2, '.', '');
            }

            return $item;
        });
    }
}
