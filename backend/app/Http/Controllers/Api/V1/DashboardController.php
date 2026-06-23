<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dashboard\ListExpiringSoonSubscriptions;
use App\Actions\Dashboard\SalesTodayReport;
use App\Actions\Dashboard\TopProductsReport;
use App\Actions\Reports\DashboardSummary;
use App\Http\Requests\Dashboard\TopProductsRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;

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

    public function salesToday(SalesTodayReport $action): JsonResponse
    {
        return $this->success(
            data: $action->execute(),
            message: "Today's sales retrieved",
        );
    }

    public function topProducts(TopProductsRequest $request, TopProductsReport $action): JsonResponse
    {
        $limit = $request->input('limit', 5);
        $period = $request->input('period', 'week');

        return $this->success(
            data: $action->execute($limit, $period),
            message: 'Top products retrieved',
        );
    }

    public function summary(DashboardSummary $action): JsonResponse
    {
        $summary = $action->execute();

        return $this->success(
            data: $summary,
            message: 'Dashboard summary retrieved'
        );
    }
}
