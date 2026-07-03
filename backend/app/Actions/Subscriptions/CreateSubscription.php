<?php

namespace App\Actions\Subscriptions;

use App\Actions\Payments\RecordPayment;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateSubscription
{
    public function __construct(
        private readonly RecordPayment $recordPayment,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $seller): Subscription
    {
        $member = Member::query()->findOrFail($data['member_id']);
        $plan = Plan::query()->findOrFail($data['plan_id']);

        if ($member->status !== 'active') {
            throw ValidationException::withMessages([
                'member_id' => 'Only active members can receive subscriptions.',
            ]);
        }

        if (! $plan->isSellable()) {
            throw ValidationException::withMessages([
                'plan_id' => 'The selected plan is not currently sellable.',
            ]);
        }

        return DB::transaction(function () use ($data, $seller, $member, $plan): Subscription {
            $startDate = Carbon::parse($data['start_date'])->startOfDay();
            $endDate = isset($data['end_date'])
                ? Carbon::parse($data['end_date'])->startOfDay()
                : $startDate->copy()->addDays((int) $plan->duration_days);
            $cycles = $this->cycleCount($startDate, $endDate, (int) $plan->duration_days);
            $discount = number_format((float) ($data['discount'] ?? 0), 2, '.', '');
            $subtotal = bcmul((string) $plan->price, (string) $cycles, 2);
            $pricePaid = bcsub($subtotal, $discount, 2);
            $sessionAllowance = $plan->is_unlimited_sessions || $plan->sessions_count === null
                ? null
                : (int) $plan->sessions_count * $cycles;

            if (bccomp($pricePaid, '0.00', 2) === -1) {
                throw ValidationException::withMessages([
                    'discount' => 'Discount cannot exceed the subscription total.',
                ]);
            }

            $subscription = Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => 'active',
                'price_paid' => $pricePaid,
                'discount' => $discount,
                'sessions_total' => $sessionAllowance,
                'sessions_remaining' => $sessionAllowance,
                'sold_by_user_id' => $seller->id,
                'created_by' => $seller->id,
            ]);

            if (bccomp($pricePaid, '0.00', 2) === 1) {
                $this->recordPayment->handle($subscription, $data['payment'], $seller);
            }

            return $subscription->load(['member', 'plan', 'soldBy', 'payments']);
        });
    }

    private function cycleCount(Carbon $startDate, Carbon $endDate, int $durationDays): int
    {
        if ($durationDays <= 0 || $endDate->lessThanOrEqualTo($startDate)) {
            return 1;
        }

        return max(1, (int) ceil($startDate->diffInDays($endDate) / $durationDays));
    }
}
