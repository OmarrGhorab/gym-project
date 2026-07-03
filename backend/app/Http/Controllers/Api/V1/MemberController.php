<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Members\DeactivateMember;
use App\Actions\Members\StoreMember;
use App\Actions\Members\StoreMemberPhoto;
use App\Actions\Members\UpdateMember;
use App\Http\Requests\Members\StoreMemberRequest;
use App\Http\Requests\Members\UpdateMemberRequest;
use App\Http\Requests\Members\UploadMemberPhotoRequest;
use App\Http\Resources\MemberResource;
use App\Http\Resources\PaymentResource;
use App\Models\Member;
use App\Models\MemberBooking;
use App\Models\MemberDocument;
use App\Models\MemberNutritionPlan;
use App\Models\MemberProgressEntry;
use App\Models\MemberWorkoutPlan;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

final class MemberController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Member::class);

        $perPage = min(max((int) $request->integer('per_page', 15), 1), 100);

        $members = QueryBuilder::for(Member::withTotalPaid()->with(['latestSubscription.plan', 'coach']))
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('gender'),
                AllowedFilter::callback('search', function ($query, string $value): void {
                    $value = trim($value);

                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'like', "{$value}%")
                            ->orWhere('phone', 'like', "{$value}%")
                            ->orWhere('phone', 'like', '+'.$value.'%');
                    });
                }),
                AllowedFilter::callback('plan_id', function ($query, $value): void {
                    $query->whereHas('subscriptions', function ($q) use ($value): void {
                        $q->where('plan_id', $value);
                    });
                }),
                AllowedFilter::callback('subscription_status', function ($query, string $value): void {
                    if ($value === 'none') {
                        $query->whereDoesntHave('subscriptions');

                        return;
                    }

                    $query->whereHas('subscriptions', function ($q) use ($value): void {
                        $q->where('status', $value);
                    });
                }),
                AllowedFilter::callback('billing', function ($query, string $value): void {
                    $value = strtolower($value);

                    if ($value === 'paid') {
                        $query->whereHas('subscriptions.payments', function ($q): void {
                            $q->whereIn('status', ['paid', 'partial']);
                        });

                        return;
                    }

                    if ($value === 'overdue') {
                        $query->whereHas('subscriptions.payments', function ($q): void {
                            $q->whereNotIn('status', ['paid', 'partial'])
                                ->whereDate('due_date', '<', Carbon::today());
                        });

                        return;
                    }

                    if ($value === 'trial') {
                        $query->whereDoesntHave('subscriptions');

                        return;
                    }

                    if ($value === 'pending') {
                        $query->whereDoesntHave('subscriptions.payments', function ($q): void {
                            $q->whereIn('status', ['paid', 'partial']);
                        })->whereDoesntHave('subscriptions.payments', function ($q): void {
                            $q->whereNotIn('status', ['paid', 'partial'])
                                ->whereDate('due_date', '<', Carbon::today());
                        });
                    }
                }),
                AllowedFilter::callback('joined_from', function ($query, string $value): void {
                    $query->whereDate('join_date', '>=', $value);
                }),
                AllowedFilter::callback('joined_to', function ($query, string $value): void {
                    $query->whereDate('join_date', '<=', $value);
                }),
                AllowedFilter::callback('qr', function ($query, string $value): void {
                    if ($value === 'ready') {
                        $query->whereNotNull('attendance_code');

                        return;
                    }

                    if ($value === 'missing') {
                        $query->whereNull('attendance_code');
                    }
                }),
            )
            ->allowedSorts(
                AllowedSort::field('name'),
                AllowedSort::field('join_date'),
                AllowedSort::field('status'),
                AllowedSort::field('created_at'),
            )
            ->defaultSort('-created_at')
            ->paginate($perPage)
            ->withQueryString();

        return $this->success(
            data: MemberResource::collection($members->getCollection())->resolve(),
            message: 'Members retrieved',
            meta: [
                'current_page' => $members->currentPage(),
                'per_page' => $members->perPage(),
                'total' => $members->total(),
                'last_page' => $members->lastPage(),
            ],
        );
    }

    public function store(StoreMemberRequest $request, StoreMember $action): JsonResponse
    {
        $member = $action->handle($request->validated(), $request->user());

        return (new MemberResource($member))
            ->withMessage('Member created')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Member $member): JsonResponse
    {
        $this->authorize('view', $member);

        $member = Member::withTotalPaid()
            ->with(['latestSubscription.plan', 'coach'])
            ->whereKey($member->id)
            ->firstOrFail();

        return (new MemberResource($member))
            ->withMessage('Member retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function update(UpdateMemberRequest $request, Member $member, UpdateMember $action): JsonResponse
    {
        $member = $action->handle($member, $request->validated());

        return (new MemberResource($member))
            ->withMessage('Member updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Request $request, Member $member, DeactivateMember $action): JsonResponse
    {
        $this->authorize('delete', $member);

        $member = $action->handle($member);

        return (new MemberResource($member))
            ->withMessage('Member deactivated')
            ->response()
            ->setStatusCode(200);
    }

    public function uploadPhoto(UploadMemberPhotoRequest $request, Member $member, StoreMemberPhoto $action): JsonResponse
    {
        $member = $action->handle($member, $request->file('photo'));

        return (new MemberResource($member))
            ->withMessage('Photo uploaded')
            ->response()
            ->setStatusCode(200);
    }

    public function streamPhoto(Request $request, Member $member): Response
    {
        $this->authorize('view', $member);

        if (! $member->photo_path || ! Storage::disk('local')->exists($member->photo_path)) {
            abort(404, 'No photo found for this member.');
        }

        $content = Storage::disk('local')->get($member->photo_path);
        $mime = Storage::disk('local')->mimeType($member->photo_path) ?: 'application/octet-stream';
        $disposition = str_starts_with($mime, 'image/') ? 'inline' : 'attachment';

        return response($content, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition,
        ]);
    }

    public function payments(Request $request, Member $member): JsonResponse
    {
        $this->authorize('view', $member);
        $this->authorize('viewAny', Payment::class);

        $payments = Payment::query()
            ->where(function ($query) use ($member): void {
                $query->whereHasMorph(
                    'payable',
                    [Subscription::class],
                    fn ($q) => $q->where('member_id', $member->id),
                );
                $query->orWhereHasMorph(
                    'payable',
                    [Sale::class],
                    fn ($q) => $q->where('member_id', $member->id),
                );
            })
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: PaymentResource::collection($payments->getCollection())->resolve(),
            message: 'Member payments retrieved',
            meta: [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        );
    }

    public function paymentHistory(Request $request, Member $member): JsonResponse
    {
        $this->authorize('view', $member);

        $subscriptions = Subscription::query()
            ->with(['plan', 'payments'])
            ->where('member_id', $member->id)
            ->latest()
            ->get();

        $sales = Sale::query()
            ->with(['items.product', 'payment', 'soldBy'])
            ->where('member_id', $member->id)
            ->latest()
            ->get();

        $subscriptionPayments = $subscriptions
            ->flatMap(fn (Subscription $subscription) => $subscription->payments->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'subscription_id' => $subscription->id,
                'plan_name' => $subscription->plan?->name,
                'amount' => number_format((float) $payment->amount, 2, '.', ''),
                'method' => $payment->method,
                'status' => $payment->status,
                'paid_at' => $payment->paid_at?->toIso8601String(),
                'due_date' => $payment->due_date?->toDateString(),
            ]))
            ->values();

        $productPurchases = $sales->map(fn (Sale $sale) => [
            'id' => $sale->id,
            'total' => number_format((float) $sale->total, 2, '.', ''),
            'payment_method' => $sale->payment_method,
            'status' => $sale->status,
            'sold_by' => $sale->soldBy?->name,
            'created_at' => $sale->created_at?->toIso8601String(),
            'items' => $sale->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'product_name' => $item->product?->name,
                'quantity' => (int) $item->quantity,
                'unit_price' => number_format((float) $item->unit_price, 2, '.', ''),
                'total' => number_format((float) $item->total, 2, '.', ''),
            ])->values(),
        ])->values();

        $subscriptionTotal = $subscriptions->reduce(
            fn (string $carry, Subscription $subscription) => bcadd($carry, (string) $subscription->price_paid, 2),
            '0.00'
        );
        $subscriptionPaid = $subscriptionPayments->reduce(
            fn (string $carry, array $payment) => $payment['status'] === 'paid' || $payment['status'] === 'partial'
                ? bcadd($carry, $payment['amount'], 2)
                : $carry,
            '0.00'
        );
        $productPaid = $sales->reduce(
            fn (string $carry, Sale $sale) => $sale->status === 'completed' ? bcadd($carry, (string) $sale->total, 2) : $carry,
            '0.00'
        );

        return $this->success(
            data: [
                'member' => [
                    'id' => $member->id,
                    'name' => $member->name,
                    'phone' => $member->phone,
                ],
                'totals' => [
                    'subscription_total' => number_format((float) $subscriptionTotal, 2, '.', ''),
                    'subscription_paid' => number_format((float) $subscriptionPaid, 2, '.', ''),
                    'product_paid' => number_format((float) $productPaid, 2, '.', ''),
                    'total_paid' => number_format((float) bcadd($subscriptionPaid, $productPaid, 2), 2, '.', ''),
                    'outstanding_balance' => number_format((float) max(0, (float) bcsub($subscriptionTotal, $subscriptionPaid, 2)), 2, '.', ''),
                ],
                'subscription_payments' => $subscriptionPayments,
                'product_purchases' => $productPurchases,
            ],
            message: 'Member payment history retrieved'
        );
    }
    public function report(Request $request, Member $member): JsonResponse
    {
        $this->authorize('view', $member);

        $member = Member::withTotalPaid()
            ->with(['latestSubscription.plan', 'coach'])
            ->whereKey($member->id)
            ->firstOrFail();

        $subscriptions = Subscription::query()
            ->with(['plan', 'freezes'])
            ->where('member_id', $member->id)
            ->orderBy('start_date')
            ->get();

        $progress = MemberProgressEntry::query()
            ->where('member_id', $member->id)
            ->orderBy('recorded_on')
            ->get();

        $visits = $member->visits()
            ->latest('check_in_at')
            ->limit(50)
            ->get();

        $firstProgress = $progress->first();
        $latestProgress = $progress->last();
        $totalVisits = $member->visits()->count();
        $blockedVisits = $member->visits()->where('status', 'blocked')->count();
        $paidTotal = Payment::query()
            ->whereHasMorph('payable', [Subscription::class], fn ($q) => $q->where('member_id', $member->id))
            ->whereIn('status', ['paid', 'partial'])
            ->sum('amount');

        return $this->success(
            data: [
                'member' => (new MemberResource($member))->resolve($request),
                'summary' => [
                    'days_at_gym' => $member->join_date ? $member->join_date->diffInDays(now()) + 1 : null,
                    'total_visits' => $totalVisits,
                    'blocked_visits' => $blockedVisits,
                    'subscriptions_count' => $subscriptions->count(),
                    'total_paid' => number_format((float) $paidTotal, 2, '.', ''),
                    'weight_change_kg' => $firstProgress?->weight_kg !== null && $latestProgress?->weight_kg !== null
                        ? number_format((float) $latestProgress->weight_kg - (float) $firstProgress->weight_kg, 2, '.', '')
                        : null,
                    'latest_weight_kg' => $latestProgress?->weight_kg,
                    'latest_body_fat_percent' => $latestProgress?->body_fat_percent,
                ],
                'subscriptions' => $subscriptions->map(fn (Subscription $subscription) => [
                    'id' => $subscription->id,
                    'plan_name' => $subscription->plan?->name,
                    'start_date' => $subscription->start_date?->toDateString(),
                    'end_date' => $subscription->end_date?->toDateString(),
                    'status' => $subscription->status,
                    'price_paid' => number_format((float) $subscription->price_paid, 2, '.', ''),
                    'freezes_count' => $subscription->freezes->count(),
                ])->values(),
                'progress' => $progress->map(fn (MemberProgressEntry $entry) => [
                    'id' => $entry->id,
                    'recorded_on' => $entry->recorded_on?->toDateString(),
                    'weight_kg' => $entry->weight_kg,
                    'body_fat_percent' => $entry->body_fat_percent,
                    'chest_cm' => $entry->chest_cm,
                    'waist_cm' => $entry->waist_cm,
                    'hips_cm' => $entry->hips_cm,
                    'arms_cm' => $entry->arms_cm,
                    'thighs_cm' => $entry->thighs_cm,
                    'notes' => $entry->notes,
                ])->values(),
                'workout_plans' => MemberWorkoutPlan::query()
                    ->with('coach')
                    ->where('member_id', $member->id)
                    ->latest()
                    ->get()
                    ->map(fn (MemberWorkoutPlan $plan) => [
                        'id' => $plan->id,
                        'title' => $plan->title,
                        'status' => $plan->status,
                        'starts_on' => $plan->starts_on?->toDateString(),
                        'ends_on' => $plan->ends_on?->toDateString(),
                        'coach' => $plan->coach ? ['id' => $plan->coach->id, 'name' => $plan->coach->name] : null,
                        'sessions' => $plan->sessions ?? [],
                        'notes' => $plan->notes,
                    ])->values(),
                'nutrition_plans' => MemberNutritionPlan::query()
                    ->with('coach')
                    ->where('member_id', $member->id)
                    ->latest()
                    ->get()
                    ->map(fn (MemberNutritionPlan $plan) => [
                        'id' => $plan->id,
                        'title' => $plan->title,
                        'status' => $plan->status,
                        'daily_calories' => $plan->daily_calories,
                        'protein_grams' => $plan->protein_grams,
                        'carbs_grams' => $plan->carbs_grams,
                        'fat_grams' => $plan->fat_grams,
                        'supplements' => $plan->supplements,
                        'notes' => $plan->notes,
                        'coach' => $plan->coach ? ['id' => $plan->coach->id, 'name' => $plan->coach->name] : null,
                    ])->values(),
                'documents' => MemberDocument::query()
                    ->where('member_id', $member->id)
                    ->latest()
                    ->get(['id', 'type', 'title', 'expires_on', 'notes', 'created_at']),
                'bookings' => MemberBooking::query()
                    ->with('coach')
                    ->where('member_id', $member->id)
                    ->latest('starts_at')
                    ->limit(20)
                    ->get()
                    ->map(fn (MemberBooking $booking) => [
                        'id' => $booking->id,
                        'title' => $booking->title,
                        'type' => $booking->type,
                        'starts_at' => $booking->starts_at?->toIso8601String(),
                        'ends_at' => $booking->ends_at?->toIso8601String(),
                        'status' => $booking->status,
                        'coach' => $booking->coach ? ['id' => $booking->coach->id, 'name' => $booking->coach->name] : null,
                        'notes' => $booking->notes,
                    ])->values(),
                'recent_visits' => $visits->map(fn ($visit) => [
                    'id' => $visit->id,
                    'check_in_at' => $visit->check_in_at?->toIso8601String(),
                    'check_out_at' => $visit->check_out_at?->toIso8601String(),
                    'status' => $visit->status,
                    'alert_reason' => $visit->alert_reason,
                ])->values(),
            ],
            message: 'Member report retrieved'
        );
    }
}



