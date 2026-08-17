<?php

namespace App\Actions\Subscriptions;

use App\Actions\Commissions\CalculateCommission;
use App\Models\Commission;
use App\Models\Subscription;
use Illuminate\Support\Carbon;

class UpdateSubscription
{
    public function __construct(private readonly CalculateCommission $calculateCommission) {}

    /**
     * Corrects the member-specific values captured when a membership was sold:
     * its dates, price, discount, session allowance, or cancellation window.
     *
     * Payments are deliberately untouched. What the member handed over is a
     * historical fact that already counted toward a day's revenue and a
     * cashier's shift, so restating it here would rewrite closed books. The
     * balance follows from price minus what has settled, so correcting the
     * price is enough to leave the member owing the right amount; anything
     * actually collected still goes through the payments endpoint.
     *
     * The status column is left alone too — a period moved into the future
     * reads as scheduled, and one moved into the past reads as expired, both
     * derived at render time rather than stored.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data): Subscription
    {
        $changes = [];
        $previousCoachId = $subscription->coach_id;

        if (array_key_exists('coach_id', $data)) {
            $changes['coach_id'] = $data['coach_id'] === null ? null : (int) $data['coach_id'];
        }

        if (array_key_exists('start_date', $data)) {
            $changes['start_date'] = Carbon::parse($data['start_date'])->startOfDay();
        }

        if (array_key_exists('end_date', $data)) {
            $changes['end_date'] = Carbon::parse($data['end_date'])->startOfDay();
        }

        if (array_key_exists('price_paid', $data)) {
            $changes['price_paid'] = number_format((float) $data['price_paid'], 2, '.', '');
        }

        if (array_key_exists('discount', $data)) {
            $changes['discount'] = number_format((float) ($data['discount'] ?? 0), 2, '.', '');
        }

        if (array_key_exists('cancellation_grace_days', $data)) {
            $changes['cancellation_grace_days'] = (int) $data['cancellation_grace_days'];
        }

        if (array_key_exists('sessions_total', $data)) {
            $changes['sessions_total'] = $data['sessions_total'] === null
                ? null
                : (int) $data['sessions_total'];
        }

        if (array_key_exists('sessions_remaining', $data)) {
            $changes['sessions_remaining'] = $data['sessions_remaining'] === null
                ? null
                : (int) $data['sessions_remaining'];
        }

        if ($changes !== []) {
            $subscription->update($changes);
        }

        if (array_key_exists('coach_id', $changes) && $changes['coach_id'] !== $previousCoachId) {
            $this->moveCoachCredit($subscription, $previousCoachId);
        }

        return $subscription->fresh(['member', 'plan', 'coach', 'soldBy', 'payments', 'addons.plan', 'addons.payments', 'freezes']);
    }

    /**
     * Hands the membership's coaching credit to whoever now runs it.
     *
     * Only unsettled credit moves. A commission already flipped to paid left
     * the gym in a payroll run, and rewriting it would restate a payslip that
     * has been handed over — the same reason payments are left alone above. So
     * a coach corrected after payday keeps what they were paid, and the new
     * coach starts earning from the correction onward.
     */
    private function moveCoachCredit(Subscription $subscription, ?int $previousCoachId): void
    {
        if ($previousCoachId !== null) {
            Commission::query()
                ->where('source_type', Subscription::class)
                ->where('source_id', $subscription->id)
                ->where('employee_id', $previousCoachId)
                ->where('commission_type', 'subscription_coach')
                ->where('status', 'pending')
                ->delete();
        }

        // Rebuilds the coach row for the new coach. The seller's row is keyed on
        // the same source and survives untouched.
        $this->calculateCommission->forSource(
            $subscription->fresh(['plan', 'coach.planCommissionRules']) ?? $subscription
        );
    }
}
