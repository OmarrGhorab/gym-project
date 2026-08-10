<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\MemberVisits\AutoCloseStaleMemberVisits;
use App\Actions\MemberVisits\CheckInMemberVisit;
use App\Actions\MemberVisits\CheckOutMemberVisit;
use App\Actions\MemberVisits\ReviewMemberVisit;
use App\Actions\MemberVisits\StoreMemberVisit;
use App\Actions\MemberVisits\UpdateMemberVisit;
use App\Http\Requests\MemberVisits\ScanMemberVisitRequest;
use App\Http\Requests\MemberVisits\StoreMemberVisitRequest;
use App\Http\Requests\MemberVisits\UpdateMemberVisitRequest;
use App\Http\Resources\MemberVisitResource;
use App\Models\MemberVisit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

final class MemberVisitController extends ApiController
{
    public function index(Request $request, AutoCloseStaleMemberVisits $autoCloseStaleVisits): JsonResponse
    {
        $this->authorize('viewAny', MemberVisit::class);
        $autoCloseStaleVisits->handle();

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        // "Visits this month" is counted over the month being viewed, not always the
        // current one, so browsing an earlier day shows the tally as it stood then.
        $month = Carbon::parse($request->input('filter.from') ?: Carbon::now());
        $monthStart = $month->copy()->startOfMonth()->toDateTimeString();
        $monthEnd = $month->copy()->endOfMonth()->toDateTimeString();

        $visits = QueryBuilder::for(MemberVisit::class)
            ->with([
                // Aggregated in one query alongside the page: counting per row would be an
                // N+1 across every visit in the day sheet.
                'member' => fn ($query) => $query->withCount([
                    'visits as visits_this_month' => fn ($visitQuery) => $visitQuery
                        ->whereBetween('check_in_at', [$monthStart, $monthEnd])
                        ->whereIn('status', ['allowed', 'flagged']),
                ]),
                'member.latestSubscription.plan',
                'subscription.plan',
                'creator',
            ])
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
            ->paginate($perPage)
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

        return (new MemberVisitResource($this->loadForScanResponse($visit)))
            ->withMessage($this->scanMessage($visit))
            ->response()
            ->setStatusCode(201);
    }

    public function checkIn(ScanMemberVisitRequest $request, CheckInMemberVisit $action): JsonResponse
    {
        $visit = $action->handle($request->validated(), $request->user());

        return (new MemberVisitResource($this->loadForScanResponse($visit)))
            ->withMessage($this->scanMessage($visit))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * The desk decides what to do from this response alone, so it has to name the
     * member and the plan. Without eager-loading, the Resource renders a freshly
     * created visit with a null member and no plan name.
     */
    private function loadForScanResponse(MemberVisit $visit): MemberVisit
    {
        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        // load(), not loadMissing(): the check-in action has usually attached the
        // member already, and loadMissing would skip it — leaving the count null.
        // Counted the same way the day sheet counts it, so the desk is never shown
        // two different "visits this month" for the same member.
        $visit->load([
            'member' => fn ($query) => $query->withCount([
                'visits as visits_this_month' => fn ($visitQuery) => $visitQuery
                    ->whereBetween('check_in_at', [$monthStart, $monthEnd])
                    ->whereIn('status', ['allowed', 'flagged']),
            ]),
        ]);

        return $visit->loadMissing(['subscription.plan', 'subscriptionAddon.plan']);
    }

    private function scanMessage(MemberVisit $visit): string
    {
        // The action returns the existing visit, unsaved, when a scan is close enough
        // to the last one to be the same one. Saying "checked in" there would be a
        // second confirmation for a check-in that never happened.
        if (! $visit->wasRecentlyCreated) {
            return $visit->status === 'pending_review'
                ? 'Already waiting for a decision on this member.'
                : 'Repeat scan ignored — the member is already checked in.';
        }

        return match ($visit->status) {
            // A duplicate scan is held for approval and consumes nothing yet.
            // Reporting it as "allowed" told the desk the opposite of the truth.
            'pending_review' => $visit->alert_reason ?? 'Duplicate check-in is waiting for approval.',
            'flagged' => 'Member checked in with location alert',
            default => $this->successMessage($visit),
        };
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

    public function review(Request $request, MemberVisit $memberVisit, ReviewMemberVisit $action): JsonResponse
    {
        $this->authorize('update', $memberVisit);
        $decision = $request->validate(['decision' => ['required', 'in:approved,dismissed']])['decision'];

        $reviewed = $action->handle($memberVisit, $decision, $request->user());

        return (new MemberVisitResource($reviewed->fresh(['member.latestSubscription.plan', 'subscription.plan', 'creator'])))
            ->withMessage('Member visit reviewed')
            ->response();
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
