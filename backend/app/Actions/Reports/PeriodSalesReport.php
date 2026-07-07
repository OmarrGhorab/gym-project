<?php

namespace App\Actions\Reports;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use stdClass;

class PeriodSalesReport
{
    /**
     * Generate period sales report.
     *
     * @param  array<string, mixed>  $filters
     */
    public function execute(array $filters): mixed
    {
        $from = $filters['from'];
        $to = $filters['to'];
        $groupBy = $filters['group_by'];
        $productId = $filters['product_id'] ?? null;
        $cashierId = $filters['seller_id'] ?? $filters['cashier_id'] ?? null;

        if ($groupBy === 'transaction') {
            $query = DB::table('sale_items')
                ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
                ->join('products', 'products.id', '=', 'sale_items.product_id')
                ->leftJoin('members', 'members.id', '=', 'sales.member_id')
                ->leftJoin('users', 'users.id', '=', 'sales.sold_by_user_id')
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$from.' 00:00:00', $to.' 23:59:59']);

            if ($productId) {
                $query->where('sale_items.product_id', $productId);
            }
            if ($cashierId) {
                $query->where('sales.sold_by_user_id', $cashierId);
            }

            $query->selectRaw('
                    sales.id as sale_id,
                    sales.created_at,
                    sales.member_id,
                    members.name as member_name,
                    sales.sold_by_user_id,
                    users.name as cashier_name,
                    sale_items.product_id,
                    products.name as product_name,
                    products.sku as product_sku,
                    sale_items.quantity,
                    sale_items.unit_price,
                    sale_items.total as line_total,
                    sales.total as sale_total,
                    sales.payment_method
                ')
                ->orderBy('sales.created_at', 'desc')
                ->orderBy('sale_items.id', 'desc');
        } elseif ($groupBy === 'product') {
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
                ->join('sale_items', 'sale_items.sale_id', '=', 'sales.id')
                ->where('sales.status', 'completed')
                ->whereBetween('sales.created_at', [$from.' 00:00:00', $to.' 23:59:59']);

            if ($cashierId) {
                $query->where('sales.sold_by_user_id', $cashierId);
            }
            if ($productId) {
                $query->where('sale_items.product_id', $productId);
            }

            $query->groupBy('sales.sold_by_user_id', 'users.name')
                ->selectRaw('
                    sales.sold_by_user_id,
                    users.name as cashier_name,
                    SUM(DISTINCT sales.total) as revenue,
                    COUNT(DISTINCT sales.id) as sales_count,
                    CAST(SUM(sale_items.quantity) AS SIGNED) as units_sold
                ')
                ->orderBy('sales.sold_by_user_id');
        } else { // day
            return $this->dailyChartRows($from, $to, $productId, $cashierId);
        }

        $formatRow = function ($item) {
            if (isset($item->revenue)) {
                $item->revenue = number_format((float) $item->revenue, 2, '.', '');
            }
            if (isset($item->unit_price)) {
                $item->unit_price = number_format((float) $item->unit_price, 2, '.', '');
            }
            if (isset($item->line_total)) {
                $item->line_total = number_format((float) $item->line_total, 2, '.', '');
            }
            if (isset($item->sale_total)) {
                $item->sale_total = number_format((float) $item->sale_total, 2, '.', '');
            }
            if (isset($item->quantity)) {
                $item->quantity = (int) $item->quantity;
            }

            return $item;
        };

        if ($groupBy === 'transaction') {
            return $query->cursorPaginate(100)->through($formatRow);
        }

        return $query->get()->map($formatRow)->values();
    }

    private function dailyChartRows(string $from, string $to, mixed $productId, mixed $cashierId)
    {
        $salesRows = DB::table('sales')
            ->join('sale_items', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.created_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->when($cashierId, fn ($query) => $query->where('sales.sold_by_user_id', $cashierId))
            ->when($productId, fn ($query) => $query->where('sale_items.product_id', $productId))
            ->groupBy(DB::raw('DATE(sales.created_at)'))
            ->selectRaw('
                DATE(sales.created_at) as date,
                SUM(DISTINCT sales.total) as revenue,
                COUNT(DISTINCT sales.id) as sales_count,
                CAST(SUM(sale_items.quantity) AS SIGNED) as units_sold
            ')
            ->get()
            ->keyBy('date');

        $subscriptionRows = DB::table('subscriptions')
            ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->when($cashierId, fn ($query) => $query->where('sold_by_user_id', $cashierId))
            ->when($productId, fn ($query) => $query->whereRaw('1 = 0'))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->selectRaw('DATE(created_at) as date, COUNT(*) as membership_subscriptions')
            ->pluck('membership_subscriptions', 'date');

        $rows = collect();
        $current = CarbonImmutable::parse($to);
        $start = CarbonImmutable::parse($from);

        while ($current->greaterThanOrEqualTo($start)) {
            $date = $current->toDateString();
            $sales = $salesRows->get($date);
            $row = new stdClass();
            $row->date = $date;
            $row->revenue = number_format((float) ($sales->revenue ?? 0), 2, '.', '');
            $row->sales_count = (int) ($sales->sales_count ?? 0);
            $row->units_sold = (int) ($sales->units_sold ?? 0);
            $row->membership_subscriptions = (int) ($subscriptionRows[$date] ?? 0);
            $rows->push($row);

            $current = $current->subDay();
        }

        return $rows->values();
    }
}
