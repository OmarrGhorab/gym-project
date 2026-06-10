<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Subscriptions\CreateSubscription;
use App\Actions\Subscriptions\FreezeSubscription;
use App\Actions\Subscriptions\RenewSubscription;
use App\Actions\Subscriptions\StopSubscription;
use App\Actions\Subscriptions\UnfreezeSubscription;
use App\Http\Requests\Subscriptions\FreezeSubscriptionRequest;
use App\Http\Requests\Subscriptions\RenewSubscriptionRequest;
use App\Http\Requests\Subscriptions\StoreSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SubscriptionController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Subscription::class);

        $subscriptions = QueryBuilder::for(Subscription::class)
            ->with(['member', 'plan', 'soldBy'])
            ->allowedFilters(
                AllowedFilter::exact('member_id'),
                AllowedFilter::exact('status'),
            )
            ->allowedSorts('created_at', 'start_date', 'end_date')
            ->defaultSort('-created_at')
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: SubscriptionResource::collection($subscriptions->getCollection())->resolve(),
            message: 'Subscriptions retrieved',
            meta: [
                'current_page' => $subscriptions->currentPage(),
                'per_page' => $subscriptions->perPage(),
                'total' => $subscriptions->total(),
                'last_page' => $subscriptions->lastPage(),
            ],
        );
    }

    public function store(StoreSubscriptionRequest $request, CreateSubscription $action): JsonResponse
    {
        $subscription = $action->handle($request->validated(), $request->user());

        return (new SubscriptionResource($subscription))
            ->withMessage('Subscription created')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Subscription $subscription): JsonResponse
    {
        $this->authorize('view', $subscription);

        return (new SubscriptionResource($subscription->load(['member', 'plan', 'soldBy', 'payments'])))
            ->withMessage('Subscription retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function renew(
        RenewSubscriptionRequest $request,
        Subscription $subscription,
        RenewSubscription $action,
    ): JsonResponse {
        $renewed = $action->handle($subscription, $request->validated(), $request->user());

        return (new SubscriptionResource($renewed))
            ->withMessage('Subscription renewed')
            ->response()
            ->setStatusCode(201);
    }

    public function freeze(
        FreezeSubscriptionRequest $request,
        Subscription $subscription,
        FreezeSubscription $action,
    ): JsonResponse {
        $frozen = $action->handle($subscription, $request->validated(), $request->user());

        return (new SubscriptionResource($frozen))
            ->withMessage('Subscription frozen')
            ->response()
            ->setStatusCode(200);
    }

    public function unfreeze(
        Subscription $subscription,
        UnfreezeSubscription $action,
    ): JsonResponse {
        $this->authorize('freeze', $subscription);

        $unfrozen = $action->handle($subscription);

        return (new SubscriptionResource($unfrozen))
            ->withMessage('Subscription unfrozen')
            ->response()
            ->setStatusCode(200);
    }

    public function stop(
        Subscription $subscription,
        StopSubscription $action,
    ): JsonResponse {
        $this->authorize('stop', $subscription);

        $stopped = $action->handle($subscription);

        return (new SubscriptionResource($stopped))
            ->withMessage('Subscription stopped')
            ->response()
            ->setStatusCode(200);
    }
}
