<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Support\Carbon;

class UpdateSubscription
{
    /**
     * Corrects a membership that was entered wrong: the wrong dates, or the
     * wrong price for this member.
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

        if ($changes !== []) {
            $subscription->update($changes);
        }

        return $subscription->fresh(['member', 'plan', 'soldBy', 'payments', 'addons.plan', 'addons.payments', 'freezes']);
    }
}
