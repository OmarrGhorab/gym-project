<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reminders\FindExpiringSubscriptions;
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

    public function expiringSoon(FindExpiringSubscriptions $finder): JsonResponse
    {
        $subscriptions = $finder->handle()
            ->sortBy('end_date')
            ->values();

        return $this->success(
            data: SubscriptionResource::collection($subscriptions)->resolve(),
            message: 'Expiring subscriptions retrieved',
            meta: [
                'current_page' => 1,
                'per_page' => $subscriptions->count(),
                'total' => $subscriptions->count(),
                'last_page' => 1,
            ],
        );
    }
}
