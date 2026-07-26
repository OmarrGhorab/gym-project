<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reminders\FindExpiringSubscriptions;
use App\Actions\Reports\MembershipMetrics;
use App\Actions\Subscriptions\AddSubscriptionAddon;
use App\Actions\Subscriptions\CancelSubscription;
use App\Actions\Subscriptions\CancelSubscriptionAddon;
use App\Actions\Subscriptions\CreateSubscription;
use App\Actions\Subscriptions\FreezeSubscription;
use App\Actions\Subscriptions\RenewSubscription;
use App\Actions\Subscriptions\StopSubscription;
use App\Actions\Subscriptions\UnfreezeSubscription;
use App\Actions\Subscriptions\UpgradeSubscription;
use App\Http\Requests\Subscriptions\AddSubscriptionAddonRequest;
use App\Http\Requests\Subscriptions\CancelSubscriptionRequest;
use App\Http\Requests\Subscriptions\FreezeSubscriptionRequest;
use App\Http\Requests\Subscriptions\RenewSubscriptionRequest;
use App\Http\Requests\Subscriptions\StoreSubscriptionRequest;
use App\Http\Requests\Subscriptions\UnfreezeSubscriptionRequest;
use App\Http\Requests\Subscriptions\UpgradeSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SubscriptionController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Subscription::class);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $subscriptions = QueryBuilder::for(Subscription::class)
            ->with([
                'member',
                'plan',
                'soldBy',
                'payments',
                'freezes',
                'refunds',
                'addons.plan',
                'addons.coach',
                'addons.payments',
                'member.latestSubscription.plan',
                'member.latestSubscription.payments',
                'member.latestSubscription.refunds',
                'member.latestSubscription.freezes',
                'member.latestSubscription.addons.plan',
                'member.latestSubscription.addons.coach',
                'member.latestSubscription.addons.payments',
            ])
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

    public function summary(Request $request, MembershipMetrics $metrics): JsonResponse
    {
        $this->authorize('viewAny', Subscription::class);

        $status = $request->input('filter.status');
        $memberId = $request->input('filter.member_id');
        $hasFilters = (is_string($status) && $status !== '') || is_numeric($memberId);

        $baseQuery = Subscription::query()
            ->when(is_string($status) && $status !== '', fn ($query) => $query->where('status', $status))
            ->when(is_numeric($memberId), fn ($query) => $query->where('member_id', (int) $memberId));

        $counts = (clone $baseQuery)
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        // Unfiltered summary uses shared MembershipMetrics so CRM/Default stay identical.
        if (! $hasFilters) {
            $snapshot = $metrics->snapshot();

            return $this->success(
                data: [
                    'total' => (clone $baseQuery)->count(),
                    'active' => (int) ($counts['active'] ?? 0),
                    'expired' => (int) ($counts['expired'] ?? 0),
                    'frozen' => (int) ($counts['frozen'] ?? 0),
                    'stopped' => (int) ($counts['stopped'] ?? 0),
                    'expiring_soon' => $snapshot['expiring_soon'],
                    'revenue' => $snapshot['subscription_revenue_live'],
                    'revenue_mtd' => $snapshot['subscription_revenue_mtd'],
                    'outstanding_dues_total' => $snapshot['outstanding_dues_total'],
                    'outstanding_dues_count' => $snapshot['outstanding_dues_count'],
                ],
                message: 'Subscription summary retrieved',
            );
        }

        $expiringSoon = (clone $baseQuery)
            ->where('status', 'active')
            ->withoutLaterActiveRenewal()
            ->whereBetween('end_date', [
                now()->toDateString(),
                now()->copy()->addDays(max(1, (int) app(FindExpiringSubscriptions::class)->reminderDays()))->toDateString(),
            ])
            ->count();

        $liveIds = (clone $baseQuery)->whereIn('status', ['active', 'frozen'])->select('id');
        $baseNet = (float) Payment::query()
            ->revenue()
            ->where('payable_type', Subscription::class)
            ->whereIn('payable_id', $liveIds)
            ->sum('amount');
        $addonNet = (float) Payment::query()
            ->revenue()
            ->where('payable_type', SubscriptionAddon::class)
            ->whereIn(
                'payable_id',
                SubscriptionAddon::query()->whereIn('subscription_id', $liveIds)->select('id'),
            )
            ->sum('amount');

        return $this->success(
            data: [
                'total' => (clone $baseQuery)->count(),
                'active' => (int) ($counts['active'] ?? 0),
                'expired' => (int) ($counts['expired'] ?? 0),
                'frozen' => (int) ($counts['frozen'] ?? 0),
                'stopped' => (int) ($counts['stopped'] ?? 0),
                'expiring_soon' => $expiringSoon,
                'revenue' => number_format(max(0.0, $baseNet + $addonNet), 2, '.', ''),
            ],
            message: 'Subscription summary retrieved',
        );
    }

    public function show(Subscription $subscription): JsonResponse
    {
        $this->authorize('view', $subscription);

        return (new SubscriptionResource($subscription->load([
            'member',
            'plan',
            'soldBy',
            'payments',
            'freezes',
            'addons.plan',
            'addons.coach',
            'addons.payments',
            'member.latestSubscription.plan',
            'member.latestSubscription.payments',
            'member.latestSubscription.refunds',
            'member.latestSubscription.freezes',
            'member.latestSubscription.addons.plan',
            'member.latestSubscription.addons.coach',
            'member.latestSubscription.addons.payments',
        ])))
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

    public function addAddon(
        AddSubscriptionAddonRequest $request,
        Subscription $subscription,
        AddSubscriptionAddon $action,
    ): JsonResponse {
        $updated = $action->handle($subscription, $request->validated(), $request->user());

        return (new SubscriptionResource($updated))
            ->withMessage('Extra service added to membership')
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
        UnfreezeSubscriptionRequest $request,
        Subscription $subscription,
        UnfreezeSubscription $action,
    ): JsonResponse {
        $unfrozen = $action->handle($subscription, $request->validated());

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

    public function cancel(
        CancelSubscriptionRequest $request,
        Subscription $subscription,
        CancelSubscription $action,
    ): JsonResponse {
        $cancelled = $action->handle($subscription, $request->validated(), $request->user());

        return (new SubscriptionResource($cancelled))
            ->withMessage('Subscription cancelled with refund')
            ->response()
            ->setStatusCode(200);
    }

    public function cancelAddon(
        CancelSubscriptionRequest $request,
        Subscription $subscription,
        SubscriptionAddon $addon,
        CancelSubscriptionAddon $action,
    ): JsonResponse {
        $updated = $action->handle($subscription, $addon, $request->validated(), $request->user());

        return (new SubscriptionResource($updated))
            ->withMessage('Extra service cancelled with refund')
            ->response()
            ->setStatusCode(200);
    }
}
