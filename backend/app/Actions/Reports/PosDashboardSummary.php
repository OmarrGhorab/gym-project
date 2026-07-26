<?php

namespace App\Actions\Reports;

use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class PosDashboardSummary
{
    private const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer'];

    /**
     * @param  array{period?: string, payment_method?: string}  $filters
     * @return array<string, mixed>
     */
    public function execute(array $filters = []): array
    {
        $now = CarbonImmutable::now();
        [$periodStart, $periodEnd, $previousPeriodStart, $previousPeriodEnd] = $this->periodRange(
            $filters['period'] ?? 'this-month',
            $now,
            $filters['from'] ?? null,
            $filters['to'] ?? null,
        );
        $paymentMethod = $this->paymentMethod($filters['payment_method'] ?? null);

        $salesTotal = (float) $this->salesQuery($periodStart, $periodEnd, $paymentMethod)->sum('total');
        $previousSalesTotal = (float) $this->salesQuery($previousPeriodStart, $previousPeriodEnd, $paymentMethod)->sum('total');
        $ordersCount = $this->salesQuery($periodStart, $periodEnd, $paymentMethod)->count();
        $previousOrdersCount = $this->salesQuery($previousPeriodStart, $previousPeriodEnd, $paymentMethod)->count();
        $memberBuyers = $this->salesQuery($periodStart, $periodEnd, $paymentMethod)->whereNotNull('member_id')->distinct('member_id')->count('member_id');
        $averageSale = $ordersCount > 0 ? $salesTotal / $ordersCount : 0.0;

        $inventory = $this->inventory();

        return [
            'generated_at' => $now->toIso8601String(),
            'totals' => [
                'sales' => $this->money($salesTotal),
                'sales_growth_rate' => $this->growthRate($salesTotal, $previousSalesTotal),
                'orders' => $ordersCount,
                'orders_growth_rate' => $this->growthRate($ordersCount, $previousOrdersCount),
                'member_buyers' => $memberBuyers,
                'average_sale' => $this->money($averageSale),
                'low_stock_products' => $inventory['low_stock_products'],
                'availability_rate' => $inventory['availability_rate'],
            ],
            'sales_chart' => $this->salesChart($periodStart, $periodEnd, $paymentMethod),
            'hourly_activity' => $this->hourlyActivity($now, $paymentMethod),
            'payment_methods' => $this->paymentMethods($periodStart, $periodEnd, $paymentMethod),
            'top_products' => $this->topProducts($periodStart, $periodEnd, $paymentMethod),
            'inventory' => $inventory,
            'stock_alerts' => $this->stockAlerts(),
            'recent_orders' => $this->recentOrders($paymentMethod),
        ];
    }

    /**
     * @return array<int, array{date: string, revenue: string, orders: int}>
     */
    private function salesChart(CarbonImmutable $from, CarbonImmutable $to, ?string $paymentMethod): array
    {
        $agg = $this->salesQuery($from, $to, $paymentMethod)
            ->toBase()
            ->selectRaw('DATE(created_at) as sale_date, SUM(total) as revenue, COUNT(*) as orders')
            ->groupBy('sale_date')
            ->get();

        $rows = $agg->pluck('revenue', 'sale_date');
        $orders = $agg->pluck('orders', 'sale_date');

        return collect(range(0, max(0, $from->diffInDays($to))))->map(function (int $offset) use ($from, $rows, $orders): array {
            $date = $from->addDays($offset)->toDateString();

            return [
                'date' => $date,
                'revenue' => $this->money((float) ($rows[$date] ?? 0)),
                'orders' => (int) ($orders[$date] ?? 0),
            ];
        })->all();
    }

    /**
     * @return array<int, array{hour: string, revenue: string, orders: int}>
     */
    private function hourlyActivity(CarbonImmutable $now, ?string $paymentMethod): array
    {
        $sales = $this->salesQuery($now->startOfDay(), $now->endOfDay(), $paymentMethod)
            ->get(['created_at', 'total'])
            ->groupBy(fn (Sale $sale): int => (int) $sale->created_at?->format('G'));

        return collect(range(0, 23))->map(function (int $hour) use ($sales): array {
            $rows = $sales->get($hour, collect());

            return [
                'hour' => str_pad((string) $hour, 2, '0', STR_PAD_LEFT).':00',
                'revenue' => $this->money((float) $rows->sum('total')),
                'orders' => $rows->count(),
            ];
        })->all();
    }

    /**
     * @return array<int, array{method: string, label: string, amount: string, count: int, percentage: string}>
     */
    private function paymentMethods(CarbonImmutable $from, CarbonImmutable $to, ?string $paymentMethod): array
    {
        $rows = Payment::query()
            ->where('payable_type', Sale::class)
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->when($paymentMethod, fn ($query) => $query->where('method', $paymentMethod))
            ->selectRaw('method, SUM(amount) as amount, COUNT(*) as count')
            ->groupBy('method')
            ->get()
            ->keyBy('method');
        $total = max((float) $rows->sum('amount'), 1);

        return collect(['cash' => 'Cash', 'card' => 'Card', 'bank_transfer' => 'Bank transfer'])
            ->map(fn (string $label, string $method): array => [
                'method' => $method,
                'label' => $label,
                'amount' => $this->money((float) ($rows->get($method)?->amount ?? 0)),
                'count' => (int) ($rows->get($method)?->count ?? 0),
                'percentage' => number_format(((float) ($rows->get($method)?->amount ?? 0) / $total) * 100, 1, '.', ''),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function topProducts(CarbonImmutable $from, CarbonImmutable $to, ?string $paymentMethod): array
    {
        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'completed')
            ->whereBetween('sales.created_at', [$from, $to])
            ->when($paymentMethod, fn ($query) => $query->where('sales.payment_method', $paymentMethod))
            ->groupBy('products.id', 'products.name', 'products.category', 'products.stock_quantity')
            ->orderByDesc(DB::raw('SUM(sale_items.total)'))
            ->limit(5)
            ->get([
                'products.id',
                'products.name',
                'products.category',
                'products.stock_quantity',
                DB::raw('SUM(sale_items.quantity) as units_sold'),
                DB::raw('SUM(sale_items.total) as revenue'),
            ]);
        $totalRevenue = max((float) $rows->sum('revenue'), 1);

        return [
            'share_of_sales' => number_format(min(((float) $rows->sum('revenue') / $totalRevenue) * 100, 100), 0, '.', ''),
            'categories' => $rows->groupBy('category')->map(fn ($items, string $category): array => [
                'name' => $category,
                'share' => number_format(((float) $items->sum('revenue') / $totalRevenue) * 100, 0, '.', ''),
            ])->values()->all(),
            'products' => $rows->map(fn ($row): array => [
                'id' => $row->id,
                'name' => $row->name,
                'category' => $row->category,
                'units_sold' => (int) $row->units_sold,
                'stock_quantity' => (int) $row->stock_quantity,
                'share' => number_format(((float) $row->revenue / $totalRevenue) * 100, 0, '.', ''),
                'sales' => $this->money((float) $row->revenue),
            ])->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function inventory(): array
    {
        $active = Product::query()->active();
        $total = (clone $active)->count();
        $inStock = (clone $active)->whereColumn('stock_quantity', '>', 'low_stock_threshold')->count();
        $lowStock = (clone $active)->whereColumn('stock_quantity', '<=', 'low_stock_threshold')->where('stock_quantity', '>', 0)->count();
        $out = (clone $active)->where('stock_quantity', '<=', 0)->count();
        $units = (clone $active)->sum('stock_quantity');
        $value = (clone $active)->selectRaw('SUM(stock_quantity * cost) as inventory_value')->value('inventory_value') ?? 0;

        return [
            'products_total' => $total,
            'in_stock_products' => $inStock,
            'low_stock_products' => $lowStock,
            'out_of_stock_products' => $out,
            'units_available' => (int) $units,
            'inventory_value' => $this->money((float) $value),
            'availability_rate' => $total > 0 ? number_format(($inStock / $total) * 100, 0, '.', '') : '0',
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function stockAlerts(): array
    {
        return Product::query()
            ->active()
            ->lowStock()
            ->orderBy('stock_quantity')
            ->limit(5)
            ->get()
            ->map(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'stock_quantity' => $product->stock_quantity,
                'low_stock_threshold' => $product->low_stock_threshold,
                'status' => $product->stock_quantity <= 0 ? 'out' : 'low',
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentOrders(?string $paymentMethod): array
    {
        return Sale::query()
            ->with(['items.product', 'member:id,name', 'soldBy:id,name', 'payment'])
            ->when($paymentMethod, fn ($query) => $query->where('payment_method', $paymentMethod))
            ->latest()
            ->limit(25)
            ->get()
            ->map(fn (Sale $sale): array => [
                'id' => '#'.$sale->id,
                'date' => $sale->created_at?->toIso8601String(),
                'customer' => $sale->member?->name ?? 'Walk-in',
                'seller' => $sale->soldBy?->name ?? 'Unknown',
                'payment_method' => $sale->payment_method,
                'payment' => $sale->payment?->status === 'paid' ? 'Paid' : 'Pending',
                'total' => $this->money((float) $sale->total),
                'items' => $sale->items->sum('quantity').' items',
                'status' => ucfirst($sale->status),
            ])
            ->all();
    }

    private function growthRate(float|int $current, float|int $previous): string
    {
        if ((float) $previous === 0.0) {
            return (float) $current > 0.0 ? '100.00' : '0.00';
        }

        return number_format((((float) $current - (float) $previous) / (float) $previous) * 100, 2, '.', '');
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable, 2: CarbonImmutable, 3: CarbonImmutable}
     */
    private function periodRange(string $period, CarbonImmutable $now, ?string $from = null, ?string $to = null): array
    {
        if ($from !== null || $to !== null) {
            $periodStart = CarbonImmutable::parse($from ?? $to)->startOfDay();
            $periodEnd = CarbonImmutable::parse($to ?? $from)->endOfDay();
            $days = max(1, $periodStart->diffInDays($periodEnd) + 1);

            return [
                $periodStart,
                $periodEnd,
                $periodStart->subDays($days)->startOfDay(),
                $periodStart->subDay()->endOfDay(),
            ];
        }

        return match ($period) {
            'last-month' => [
                $now->subMonthNoOverflow()->startOfMonth(),
                $now->subMonthNoOverflow()->endOfMonth(),
                $now->subMonthsNoOverflow(2)->startOfMonth(),
                $now->subMonthsNoOverflow(2)->endOfMonth(),
            ],
            'last-30-days' => [
                $now->subDays(29)->startOfDay(),
                $now->endOfDay(),
                $now->subDays(59)->startOfDay(),
                $now->subDays(30)->endOfDay(),
            ],
            'year-to-date' => [
                $now->startOfYear(),
                $now->endOfDay(),
                $now->subYearNoOverflow()->startOfYear(),
                $now->subYearNoOverflow()->endOfDay(),
            ],
            default => [
                $now->startOfMonth(),
                $now->endOfDay(),
                $now->subMonthNoOverflow()->startOfMonth(),
                $now->subMonthNoOverflow()->endOfMonth(),
            ],
        };
    }

    private function paymentMethod(?string $paymentMethod): ?string
    {
        return in_array($paymentMethod, self::PAYMENT_METHODS, true) ? $paymentMethod : null;
    }

    private function salesQuery(CarbonImmutable $from, CarbonImmutable $to, ?string $paymentMethod)
    {
        return Sale::query()
            ->completed()
            ->whereBetween('created_at', [$from, $to])
            ->when($paymentMethod, fn ($query) => $query->where('payment_method', $paymentMethod));
    }
}
