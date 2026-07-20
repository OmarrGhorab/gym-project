<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class SubscriptionResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $this->loadMissing(['payments', 'plan', 'addons.plan', 'addons.coach', 'addons.payments', 'refunds']);
        $balance = $this->balanceDue();
        $packageBalance = $this->packageBalanceDue();
        $packagePaidTotal = $this->packagePaidTotal();
        $collectedPaidTotal = $this->packageCollectedPaidTotal();
        $refundTotal = $this->refundTotal();
        $daysLeft = $this->daysLeft();
        $status = $this->effectiveStatus();
        $cancellationGraceDays = $this->cancellationGraceDays();
        $cancellationGraceEndsOn = $this->cancellationGraceEndsOn($cancellationGraceDays);
        // Default refund is money collected (before any refund rows), not net after refunds.
        $defaultRefundAmount = $this->collectedPaidTotal();
        $canCancelWithRefund = in_array($status, ['active', 'frozen'], true)
            && Carbon::today()->lte($cancellationGraceEndsOn)
            && $this->refundsLoadedEmpty();
        $billingStatus = $this->billingStatus($packagePaidTotal, $packageBalance, $refundTotal);

        return [
            'id' => $this->id,
            'status' => $status,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'freeze' => $this->freezeSnapshot(),
            'price_paid' => $this->price_paid,
            'paid_total' => $this->paidTotal(),
            'collected_paid_total' => $collectedPaidTotal,
            'refund_total' => $refundTotal,
            'package_price_paid' => $this->packagePricePaid(),
            'package_paid_total' => $packagePaidTotal,
            'package_balance' => $packageBalance,
            'balance' => $balance,
            'billing_status' => $billingStatus,
            'cancellation_grace_days' => $cancellationGraceDays,
            'cancellation_grace_ends_on' => $cancellationGraceEndsOn->toDateString(),
            'can_cancel_with_refund' => $canCancelWithRefund,
            'default_refund_amount' => $defaultRefundAmount,
            'days_left' => $daysLeft,
            'renewal_health' => $this->renewalHealth($status, $daysLeft, $packageBalance, $refundTotal),
            'renewal_health_reason' => $this->renewalHealthReason($status, $daysLeft, $packageBalance, $refundTotal),
            'discount' => $this->discount,
            'sessions_total' => $this->sessions_total,
            'sessions_remaining' => $this->sessions_remaining,
            'last_reminded_on' => $this->last_reminded_on?->toDateString(),
            'member' => $this->whenLoaded('member', fn () => (new MemberResource($this->member))->toArray($request)),
            'plan' => $this->whenLoaded('plan', fn () => (new PlanResource($this->plan))->toArray($request)),
            'upgraded_from' => $this->whenLoaded('upgradedFrom', fn () => (new self($this->upgradedFrom))->toArray($request)),
            'sold_by' => $this->whenLoaded('soldBy', fn () => (new UserSummaryResource($this->soldBy))->toArray($request)),
            'payments' => $this->whenLoaded('payments', fn () => PaymentResource::collection($this->payments)->resolve()),
            'refunds' => $this->whenLoaded('refunds', fn () => $this->refunds->map(fn ($refund): array => [
                'id' => $refund->id,
                'amount' => number_format((float) $refund->amount, 2, '.', ''),
                'method' => $refund->method,
                'reason' => $refund->reason,
                'refunded_at' => $refund->refunded_at?->toIso8601String(),
            ])->values()->all()),
            'addons' => $this->whenLoaded('addons', fn () => SubscriptionAddonResource::collection($this->addons)->resolve()),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function paidTotal(): string
    {
        // Net of refunds (refunded rows store negative amounts).
        return $this->payments
            ->filter(fn ($payment): bool => in_array($payment->status, Payment::REVENUE_STATUSES, true))
            ->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );
    }

    private function addonPriceTotal(): string
    {
        return $this->addons->reduce(
            fn (string $carry, $addon): string => bcadd($carry, (string) ($addon->price_paid ?? '0.00'), 2),
            '0.00',
        );
    }

    private function addonPaidTotal(): string
    {
        return $this->addons->reduce(
            fn (string $carry, $addon): string => bcadd(
                $carry,
                $addon->payments
                    ->filter(fn ($payment): bool => in_array($payment->status, ['paid', 'partial'], true))
                    ->reduce(
                        fn (string $paymentCarry, $payment): string => bcadd($paymentCarry, (string) $payment->amount, 2),
                        '0.00',
                    ),
                2,
            ),
            '0.00',
        );
    }

    private function packagePricePaid(): string
    {
        return bcadd((string) ($this->price_paid ?? '0.00'), $this->addonPriceTotal(), 2);
    }

    private function packagePaidTotal(): string
    {
        return bcadd($this->paidTotal(), $this->addonPaidTotal(), 2);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function freezeSnapshot(): ?array
    {
        $this->loadMissing('freezes');
        $openFreeze = $this->freezes
            ->whereNull('resumed_on')
            ->sortByDesc('freeze_start')
            ->first();

        if ($openFreeze === null) {
            return null;
        }

        return [
            'freeze_start' => $openFreeze->freeze_start?->toDateString(),
            'freeze_end' => $openFreeze->freeze_end?->toDateString(),
            'resumed_on' => $openFreeze->resumed_on?->toDateString(),
            'planned_days' => $openFreeze->freeze_start && $openFreeze->freeze_end
                ? (int) $openFreeze->freeze_start->diffInDays($openFreeze->freeze_end) + 1
                : (int) $openFreeze->days,
            'remaining_days_at_freeze' => $openFreeze->remaining_days_at_freeze,
            'reason' => $openFreeze->reason,
        ];
    }

    private function balanceDue(): string
    {
        // Stopped/expired refunded subscriptions should not re-open a balance due.
        if (in_array($this->status, ['stopped', 'expired'], true)) {
            return '0.00';
        }

        $balance = bcsub((string) ($this->price_paid ?? '0.00'), $this->collectedPaidTotal(), 2);

        return bccomp($balance, '0.00', 2) === 1 ? $balance : '0.00';
    }

    private function packageBalanceDue(): string
    {
        if (in_array($this->status, ['stopped', 'expired'], true)) {
            return '0.00';
        }

        $balance = bcsub($this->packagePricePaid(), $this->packageCollectedPaidTotal(), 2);

        return bccomp($balance, '0.00', 2) === 1 ? $balance : '0.00';
    }

    private function billingStatus(string $packagePaidTotal, string $packageBalance, string $refundTotal): string
    {
        if (bccomp($refundTotal, '0.00', 2) === 1) {
            // Full refund (net ~0) vs partial refund still leaving net collected.
            return bccomp($packagePaidTotal, '0.00', 2) <= 0 ? 'refunded' : 'partial_refund';
        }

        if (in_array($this->status, ['stopped', 'expired'], true)) {
            return 'stopped';
        }

        if (bccomp($packageBalance, '0.00', 2) === 0 && bccomp($packagePaidTotal, '0.00', 2) === 1) {
            return 'paid';
        }

        if ($this->payments->contains(fn ($payment): bool => in_array($payment->status, Payment::COLLECTED_STATUSES, true) === false
            && $payment->status !== Payment::STATUS_REFUNDED
            && $payment->due_date !== null
            && $payment->due_date->lt(Carbon::today()))) {
            return 'overdue';
        }

        return 'pending';
    }

    private function refundTotal(): string
    {
        $this->loadMissing('refunds');

        return $this->refunds->reduce(
            fn (string $carry, $refund): string => bcadd($carry, (string) $refund->amount, 2),
            '0.00',
        );
    }

    private function collectedPaidTotal(): string
    {
        return $this->payments
            ->filter(fn ($payment): bool => in_array($payment->status, Payment::COLLECTED_STATUSES, true))
            ->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );
    }

    private function packageCollectedPaidTotal(): string
    {
        return bcadd($this->collectedPaidTotal(), $this->addonPaidTotal(), 2);
    }

    private function daysLeft(): ?int
    {
        // Closed memberships have no remaining access window to display.
        if (in_array($this->status, ['stopped', 'expired'], true)) {
            return null;
        }

        if (! $this->end_date) {
            return null;
        }

        return (int) Carbon::today()->diffInDays($this->end_date, false);
    }

    private function cancellationGraceDays(): int
    {
        if ($this->cancellation_grace_days !== null) {
            return (int) $this->cancellation_grace_days;
        }

        return (int) ($this->plan?->cancellation_grace_days ?? 2);
    }

    private function cancellationGraceEndsOn(int $graceDays): Carbon
    {
        $anchor = $this->start_date?->copy() ?? Carbon::parse($this->created_at)->startOfDay();

        if ($graceDays <= 0) {
            return $anchor->copy()->subDay();
        }

        return $anchor->copy()->addDays($graceDays - 1);
    }

    private function refundsLoadedEmpty(): bool
    {
        if ($this->relationLoaded('refunds')) {
            return $this->refunds->isEmpty();
        }

        return ! $this->refunds()->exists();
    }

    private function effectiveStatus(): string
    {
        if (! $this->end_date || $this->status !== 'active') {
            return $this->status;
        }

        $graceDays = (int) ($this->plan?->access_grace_days ?? 0);
        $accessEndsOn = $this->end_date->copy()->addDays($graceDays);

        if ($accessEndsOn->lt(Carbon::today())) {
            return 'expired';
        }

        return $this->status;
    }

    private function renewalHealth(string $status, ?int $daysLeft, string $balance, string $refundTotal): string
    {
        if ($status === 'active' && $this->start_date && Carbon::today()->diffInDays($this->start_date, false) > 0) {
            return 'renewed';
        }

        if ($status === 'expired' || bccomp($balance, '0.00', 2) === 1) {
            return 'needs_action';
        }

        if (in_array($status, ['frozen', 'stopped'], true) || bccomp($refundTotal, '0.00', 2) === 1) {
            return 'paused';
        }

        if ($daysLeft !== null && $daysLeft <= 7) {
            return 'renew_soon';
        }

        return 'active';
    }

    private function renewalHealthReason(string $status, ?int $daysLeft, string $balance, string $refundTotal): string
    {
        if ($status === 'active' && $this->start_date && Carbon::today()->diffInDays($this->start_date, false) > 0) {
            return 'next_period_starts';
        }

        if ($status === 'expired') {
            return 'expired';
        }

        if (bccomp($balance, '0.00', 2) === 1) {
            return 'has_balance';
        }

        if ($status === 'frozen') {
            return 'frozen';
        }

        if (bccomp($refundTotal, '0.00', 2) === 1) {
            return 'refunded';
        }

        if ($status === 'stopped') {
            return 'stopped';
        }

        if ($daysLeft !== null && $daysLeft <= 7) {
            return 'ends_in';
        }

        return 'active_no_balance';
    }
}
