<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\MemberVisits\AutoCloseStaleMemberVisits;
use App\Actions\MemberVisits\CheckInMemberVisit;
use App\Actions\MemberVisits\CheckOutMemberVisit;
use App\Actions\MemberVisits\StoreMemberVisit;
use App\Actions\MemberVisits\UpdateMemberVisit;
use App\Actions\MemberVisits\ResolveMemberVisitSubscription;
use App\Http\Requests\MemberVisits\ScanMemberVisitRequest;
use App\Http\Requests\MemberVisits\StoreMemberVisitRequest;
use App\Http\Requests\MemberVisits\UpdateMemberVisitRequest;
use App\Http\Resources\MemberVisitResource;
use App\Models\MemberVisit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

final class MemberVisitController extends ApiController
{
    public function index(Request $request, AutoCloseStaleMemberVisits $autoCloseStaleVisits): JsonResponse
    {
        $this->authorize('viewAny', MemberVisit::class);
        $autoCloseStaleVisits->handle();

        $visits = QueryBuilder::for(MemberVisit::class)
            ->with(['member.latestSubscription.plan', 'subscription.plan', 'creator'])
            ->allowedFilters(
                AllowedFilter::exact('member_id'),
                AllowedFilter::exact('status'),
                AllowedFilter::callback('from', function ($query, $value): void {
                    $query->where('check_in_at', '>=', $value.' 00:00:00');
                }),
                AllowedFilter::callback('to', function ($query, $value): void {
                    $query->where('check_in_at', '<=', $value.' 23:59:59');
                })
            )
            ->allowedSorts('check_in_at', 'created_at')
            ->defaultSort('-check_in_at')
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: MemberVisitResource::collection($visits->getCollection())->resolve(),
            message: 'Member visits retrieved',
            meta: [
                'current_page' => $visits->currentPage(),
                'per_page' => $visits->perPage(),
                'total' => $visits->total(),
                'last_page' => $visits->lastPage(),
            ],
        );
    }

    public function store(StoreMemberVisitRequest $request, StoreMemberVisit $action): JsonResponse
    {
        $visit = $action->handle($request->validated(), $request->user());

        $message = $visit->status === 'flagged'
            ? 'Member checked in with location alert'
            : $this->successMessage($visit);

        return (new MemberVisitResource($visit))
            ->withMessage($message)
            ->response()
            ->setStatusCode(201);
    }

    public function checkIn(ScanMemberVisitRequest $request, CheckInMemberVisit $action): JsonResponse
    {
        $visit = $action->handle($request->validated(), $request->user());

        $message = $visit->status === 'flagged'
            ? 'Member checked in with location alert'
            : $this->successMessage($visit);

        return (new MemberVisitResource($visit))
            ->withMessage($message)
            ->response()
            ->setStatusCode(201);
    }

    private function successMessage(MemberVisit $visit): string
    {
        $visit->loadMissing(['subscription', 'subscriptionAddon']);
        $remaining = $visit->subscription?->sessions_remaining;
        $parts = ['Member check-in allowed'];

        if ($remaining !== null) {
            $parts[] = "{$remaining} session(s) remaining on membership";
        }

        $addonRemaining = $visit->subscriptionAddon?->sessions_remaining;
        if ($addonRemaining !== null) {
            $parts[] = "{$addonRemaining} session(s) remaining on add-on";
        }

        return implode('. ', $parts).'.';
    }

    public function checkOut(ScanMemberVisitRequest $request, CheckOutMemberVisit $action): JsonResponse
    {
        $visit = $action->handle($request->validated(), $request->user());

        return (new MemberVisitResource($visit))
            ->withMessage('Member checkout recorded')
            ->response()
            ->setStatusCode(200);
    }

    public function review(Request $request, MemberVisit $memberVisit, ResolveMemberVisitSubscription $subscriptions): JsonResponse
    {
        $this->authorize('update', $memberVisit);
        $decision = $request->validate(['decision' => ['required', 'in:approved,dismissed']])['decision'];
        abort_unless($memberVisit->status === 'pending_review', 422, 'This visit is not pending review.');

        if ($decision === 'approved') {
            $subscription = $subscriptions->consume($memberVisit->member, $memberVisit->check_in_at);
            $addon = $memberVisit->subscription_addon_id
                ? $subscriptions->consumeAddon($memberVisit->member, $memberVisit->check_in_at, $memberVisit->subscription_addon_id)
                : $subscriptions->autoConsumeActiveAddon($memberVisit->member, $memberVisit->check_in_at, $subscription);
            $memberVisit->update(['subscription_id' => $subscription->id, 'subscription_addon_id' => $addon?->id, 'status' => 'allowed', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'alert_reason' => null]);
        } else {
            $memberVisit->update(['status' => 'blocked', 'check_out_at' => $memberVisit->check_in_at, 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        }

        return (new MemberVisitResource($memberVisit->fresh(['member.latestSubscription.plan', 'subscription.plan', 'creator'])))->withMessage('Member visit reviewed')->response();
    }

    public function show(Request $request, MemberVisit $memberVisit): JsonResponse
    {
        $this->authorize('view', $memberVisit);
        $memberVisit->load(['member.latestSubscription.plan', 'subscription.plan', 'creator']);

        return (new MemberVisitResource($memberVisit))
            ->withMessage('Member visit retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function update(UpdateMemberVisitRequest $request, MemberVisit $memberVisit, UpdateMemberVisit $action): JsonResponse
    {
        $visit = $action->handle($memberVisit, $request->validated());

        return (new MemberVisitResource($visit))
            ->withMessage('Member visit updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Request $request, MemberVisit $memberVisit): JsonResponse
    {
        $this->authorize('delete', $memberVisit);

        $memberVisit->delete();

        return response()->json(null, 204);
    }
}
