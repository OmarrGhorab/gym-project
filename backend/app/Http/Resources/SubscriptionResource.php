<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class SubscriptionResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $this->loadMissing('payments');
        $balance = $this->balanceDue();
        $daysLeft = $this->daysLeft();
        $status = $this->effectiveStatus();

        return [
            'id' => $this->id,
            'status' => $status,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'freeze' => $this->freezeSnapshot(),
            'price_paid' => $this->price_paid,
            'paid_total' => $this->paidTotal(),
            'balance' => $balance,
            'billing_status' => $this->billingStatus(),
            'days_left' => $daysLeft,
            'renewal_health' => $this->renewalHealth($status, $daysLeft, $balance),
            'renewal_health_reason' => $this->renewalHealthReason($status, $daysLeft, $balance),
            'discount' => $this->discount,
            'sessions_total' => $this->sessions_total,
            'sessions_remaining' => $this->sessions_remaining,
            'last_reminded_on' => $this->last_reminded_on?->toDateString(),
            'member' => $this->whenLoaded('member', fn () => (new MemberResource($this->member))->toArray($request)),
            'plan' => $this->whenLoaded('plan', fn () => (new PlanResource($this->plan))->toArray($request)),
            'upgraded_from' => $this->whenLoaded('upgradedFrom', fn () => (new self($this->upgradedFrom))->toArray($request)),
            'sold_by' => $this->whenLoaded('soldBy', fn () => (new UserSummaryResource($this->soldBy))->toArray($request)),
            'payments' => $this->whenLoaded('payments', fn () => PaymentResource::collection($this->payments)->resolve()),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function paidTotal(): string
    {
        return $this->payments
            ->filter(fn ($payment): bool => in_array($payment->status, ['paid', 'partial'], true))
            ->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );
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
        $balance = bcsub((string) ($this->price_paid ?? '0.00'), $this->paidTotal(), 2);

        return bccomp($balance, '0.00', 2) === 1 ? $balance : '0.00';
    }

    private function billingStatus(): string
    {
        if (bccomp($this->paidTotal(), '0.00', 2) === 1) {
            return 'paid';
        }

        if ($this->payments->contains(fn ($payment): bool => ! in_array($payment->status, ['paid', 'partial'], true)
            && $payment->due_date !== null
            && $payment->due_date->lt(Carbon::today()))) {
            return 'overdue';
        }

        return 'pending';
    }

    private function daysLeft(): ?int
    {
        if (! $this->end_date) {
            return null;
        }

        return (int) Carbon::today()->diffInDays($this->end_date, false);
    }

    private function effectiveStatus(): string
    {
        if ($this->status === 'active' && $this->end_date && $this->end_date->lt(Carbon::today())) {
            return 'expired';
        }

        return $this->status;
    }

    private function renewalHealth(string $status, ?int $daysLeft, string $balance): string
    {
        if ($status === 'active' && $this->start_date && Carbon::today()->diffInDays($this->start_date, false) > 0) {
            return 'renewed';
        }

        if ($status === 'expired' || bccomp($balance, '0.00', 2) === 1) {
            return 'needs_action';
        }

        if (in_array($status, ['frozen', 'stopped'], true)) {
            return 'paused';
        }

        if ($daysLeft !== null && $daysLeft <= 7) {
            return 'renew_soon';
        }

        return 'active';
    }

    private function renewalHealthReason(string $status, ?int $daysLeft, string $balance): string
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

        if ($status === 'stopped') {
            return 'stopped';
        }

        if ($daysLeft !== null && $daysLeft <= 7) {
            return 'ends_in';
        }

        return 'active_no_balance';
    }
}
