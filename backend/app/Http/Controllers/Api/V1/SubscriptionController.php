<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Subscriptions\CreateSubscription;
use App\Actions\Subscriptions\FreezeSubscription;
use App\Actions\Subscriptions\RenewSubscription;
use App\Actions\Subscriptions\StopSubscription;
use App\Actions\Subscriptions\UnfreezeSubscription;
use App\Actions\Subscriptions\UpgradeSubscription;
use App\Http\Requests\Subscriptions\FreezeSubscriptionRequest;
use App\Http\Requests\Subscriptions\RenewSubscriptionRequest;
use App\Http\Requests\Subscriptions\StoreSubscriptionRequest;
use App\Http\Requests\Subscriptions\UpgradeSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SubscriptionController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Subscription::class);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $subscriptions = QueryBuilder::for(Subscription::class)
            ->with(['member', 'plan', 'soldBy'])
            ->allowedFilters(
                AllowedFilter::exact('member_id'),
                AllowedFilter::exact('status'),
            )
            ->allowedSorts('created_at', 'start_date', 'end_date')
            ->defaultSort('-created_at')
            ->paginate($perPage)
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

    public function summary(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Subscription::class);

        $status = $request->input('filter.status');
        $memberId = $request->input('filter.member_id');
        $baseQuery = Subscription::query()
            ->when(is_string($status) && $status !== '', fn ($query) => $query->where('status', $status))
            ->when(is_numeric($memberId), fn ($query) => $query->where('member_id', (int) $memberId));

        $counts = (clone $baseQuery)
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');
        $today = Carbon::today();
        $expiringSoon = (clone $baseQuery)
            ->where('status', 'active')
            ->whereBetween('end_date', [$today->toDateString(), $today->copy()->addDays(7)->toDateString()])
            ->count();

        return $this->success(
            data: [
                'total' => (clone $baseQuery)->count(),
                'active' => (int) ($counts['active'] ?? 0),
                'expired' => (int) ($counts['expired'] ?? 0),
                'frozen' => (int) ($counts['frozen'] ?? 0),
                'stopped' => (int) ($counts['stopped'] ?? 0),
                'expiring_soon' => $expiringSoon,
                'revenue' => number_format((float) (clone $baseQuery)->sum('price_paid'), 2, '.', ''),
            ],
            message: 'Subscription summary retrieved',
        );
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

    public function upgrade(
        UpgradeSubscriptionRequest $request,
        Subscription $subscription,
        UpgradeSubscription $action,
    ): JsonResponse {
        $upgraded = $action->handle($subscription, $request->validated(), $request->user());

        return (new SubscriptionResource($upgraded))
            ->withMessage('Subscription upgraded')
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
