<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dashboard\ListExpiringSoonSubscriptions;
use App\Http\Requests\Dashboard\TopProductsRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends ApiController
{
    public function activeSubscriptions(): JsonResponse
    {
        $count = Subscription::query()
            ->where('status', 'active')
            ->count();

        return $this->success(
            data: ['count' => $count],
            message: 'Active subscriptions retrieved',
        );
    }

    public function expiringSoon(ListExpiringSoonSubscriptions $action): JsonResponse
    {
        $subscriptions = $action->handle();

        return $this->success(
            data: SubscriptionResource::collection($subscriptions->getCollection())->resolve(),
            message: 'Expiring subscriptions retrieved',
            meta: [
                'current_page' => $subscriptions->currentPage(),
                'per_page' => $subscriptions->perPage(),
                'total' => $subscriptions->total(),
                'last_page' => $subscriptions->lastPage(),
            ],
        );
    }

    /**
     * GET /api/v1/dashboard/sales-today
     */
    public function salesToday(): JsonResponse
    {
        $result = DB::table('sales')
            ->whereDate('created_at', now()->toDateString())
            ->where('status', 'completed')
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(total), 0) as revenue')
            ->first();

        return $this->success(
            data: [
                'count' => $result->count,
                'revenue' => number_format((float) $result->revenue, 2, '.', ''),
            ],
            message: "Today's sales retrieved",
        );
    }

    /**
     * GET /api/v1/dashboard/top-products
     */
    public function topProducts(TopProductsRequest $request): JsonResponse
    {
        $limit = $request->input('limit', 5);
        $period = $request->input('period', 'week');

        $startDate = match ($period) {
            'today' => now()->startOfDay(),
            'week' => now()->subDays(7)->startOfDay(),
            'month' => now()->subDays(30)->startOfDay(),
        };

        $topProducts = DB::table('sale_items')
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
            ->get();

        $formattedProducts = $topProducts->map(function ($product) {
            $product->revenue = number_format((float) $product->revenue, 2, '.', '');

            return $product;
        });

        return $this->success(
            data: $formattedProducts->toArray(),
            message: 'Top products retrieved',
        );
    }
}
