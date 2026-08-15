<?php

namespace App\Actions\Subscriptions;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class RenewSubscription
{
    public function __construct(
        private readonly CreateSubscription $createSubscription,
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, User $seller): Subscription
    {
        $subscription->loadMissing(['member', 'plan']);

        // A frozen period has no settled end date yet — it is recalculated from the
        // resume date. Stacking a renewal on the pre-freeze end_date would overlap the
        // days the freeze is protecting, so the freeze has to be resolved first.
        if ($subscription->status === 'frozen') {
            throw ValidationException::withMessages([
                'subscription' => 'Unfreeze this subscription before renewing it.',
            ]);
        }

        $plan = isset($data['plan_id'])
            ? Plan::query()->findOrFail($data['plan_id'])
            : $subscription->plan;

        $today = Carbon::today();

        // Only stack periods for still-live memberships (active/frozen with remaining time).
        // Stopped/expired always restart from today so cancel+renew does not double the period.
        if (in_array($subscription->status, ['stopped', 'expired'], true)) {
            $startDate = $today;
        } elseif ($subscription->end_date !== null && $subscription->end_date->gte($today)) {
            $startDate = $subscription->end_date->copy()->addDay();
        } else {
            $startDate = $today;
        }

        $alreadyRenewed = Subscription::query()
            ->whereKeyNot($subscription->getKey())
            ->where('member_id', $subscription->member_id)
            ->where('plan_id', $plan->id)
            ->where('status', 'active')
            ->whereDate('start_date', '<=', $startDate->toDateString())
            ->whereDate('end_date', '>=', $startDate->toDateString())
            ->exists();

        if ($alreadyRenewed) {
            throw ValidationException::withMessages([
                'subscription' => 'This subscription already has an active renewal for the next period.',
            ]);
        }

        // The start date is decided here, so this is the only place an end date
        // the desk typed can be judged against it.
        $endDate = $this->filled($data, 'end_date') ? Carbon::parse($data['end_date'])->startOfDay() : null;

        if ($endDate !== null && $endDate->lt($startDate)) {
            throw ValidationException::withMessages([
                'end_date' => 'The renewal cannot end before it starts on '.$startDate->toDateString().'.',
            ]);
        }

        $renewed = $this->createSubscription->handle([
            'member_id' => $subscription->member_id,
            'plan_id' => $plan->id,
            // Keep the member with their coach across periods unless the desk picked
            // someone else, and only while the plan is unchanged — a different plan
            // may not be one that coach can service.
            'coach_id' => $data['coach_id']
                ?? ($plan->id === $subscription->plan_id ? $subscription->coach_id : null),
            'start_date' => $startDate->toDateString(),
            'discount' => $data['discount'] ?? 0,
            'payment' => $data['payment'],
            'addons' => $data['addons'] ?? [],
            ...($endDate !== null ? ['end_date' => $endDate->toDateString()] : []),
            ...($this->filled($data, 'price') ? ['price' => $data['price']] : []),
            ...($this->filled($data, 'sessions_total') ? ['sessions_total' => $data['sessions_total']] : []),
            ...(array_key_exists('unlimited_sessions', $data)
                ? ['unlimited_sessions' => $data['unlimited_sessions']]
                : []),
        ], $seller);

        $this->notifier->membershipRenewedOnCustomTerms(
            $renewed,
            $seller,
            $this->describeOverrides($data, $subscription, $plan, $renewed),
        );

        return $renewed;
    }

    /**
     * What the desk actually changed, said the way an admin reads it.
     *
     * Everything is compared against what the plan would have produced, not
     * against whether a field was sent: the renewal form posts the plan's own
     * price and dates back to us untouched most of the time, and re-sending a
     * default is not a decision worth waking anyone up for.
     *
     * @param  array<string, mixed>  $data
     * @return list<string>
     */
    private function describeOverrides(array $data, Subscription $previous, Plan $plan, Subscription $renewed): array
    {
        $changes = [];

        if ((int) $plan->id !== (int) $previous->plan_id) {
            $changes[] = 'plan '.($previous->plan?->name ?? '#'.$previous->plan_id).' → '.$plan->name;
        }

        $planPrice = number_format((float) $plan->price, 2, '.', '');
        $soldFor = number_format((float) $renewed->price_paid + (float) $renewed->discount, 2, '.', '');

        if (bccomp($soldFor, $planPrice, 2) !== 0) {
            $changes[] = "price EGP {$planPrice} → {$soldFor}";
        }

        $planEnd = $plan->endDateFrom($renewed->start_date->copy())->toDateString();
        $soldEnd = $renewed->end_date->toDateString();

        if ($planEnd !== $soldEnd) {
            $changes[] = "ends {$planEnd} → {$soldEnd}";
        }

        $planSessions = $plan->is_unlimited_sessions || $plan->sessions_count === null
            ? null
            : (int) $plan->sessions_count;

        if ($planSessions !== $renewed->sessions_total) {
            $changes[] = 'sessions '.($planSessions ?? 'unlimited').' → '.($renewed->sessions_total ?? 'unlimited');
        }

        return $changes;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function filled(array $data, string $key): bool
    {
        return array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '';
    }
}
