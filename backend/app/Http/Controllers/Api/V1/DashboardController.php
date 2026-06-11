<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Dashboard\ListExpiringSoonSubscriptions;
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
}
