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

        $discount = number_format((float) ($data['discount'] ?? 0), 2, '.', '');
        $pricePaid = bcsub((string) $plan->price, $discount, 2);

        if (bccomp($pricePaid, '0.00', 2) === -1) {
            throw ValidationException::withMessages([
                'discount' => 'Discount cannot exceed the plan price.',
            ]);
        }

        return DB::transaction(function () use ($data, $seller, $member, $plan, $discount, $pricePaid): Subscription {
            $startDate = Carbon::parse($data['start_date'])->startOfDay();
            $subscription = Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $startDate->copy()->addDays((int) $plan->duration_days)->toDateString(),
                'status' => 'active',
                'price_paid' => $pricePaid,
                'discount' => $discount,
                'sold_by_user_id' => $seller->id,
                'created_by' => $seller->id,
            ]);

            $this->recordPayment->handle($subscription, $data['payment'], $seller);

            return $subscription->load(['member', 'plan', 'soldBy', 'payments']);
        });
    }
}
