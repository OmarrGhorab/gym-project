<?php

namespace App\Actions\MemberVisits;

use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class StoreMemberVisit
{
    public function __construct(
        private readonly AutoCloseStaleMemberVisits $autoCloseStaleVisits,
        private readonly EnsureMemberCanCheckIn $ensureMemberCanCheckIn,
        private readonly ResolveMemberVisitSubscription $visitSubscription,
    ) {}

    public function handle(array $data, User $user): MemberVisit
    {
        $checkIn = Carbon::parse($data['check_in_at'] ?? now());
        $member = Member::query()->findOrFail($data['member_id']);

        $visit = DB::transaction(function () use ($data, $user, $checkIn, $member): MemberVisit {
            $this->autoCloseStaleVisits->handle($checkIn);
            $this->ensureMemberCanCheckIn->handle($member);

            $subscription = $this->visitSubscription->consume($member, $checkIn);

            $addonId = isset($data['subscription_addon_id']) ? (int) $data['subscription_addon_id'] : 0;
            $addon = null;
            if ($addonId > 0) {
                $addon = $this->visitSubscription->consumeAddon($member, $checkIn, $addonId);
            } else {
                $addon = $this->visitSubscription->autoConsumeActiveAddon($member, $checkIn, $subscription);
            }

            return MemberVisit::create([
                'member_id' => $member->id,
                'subscription_id' => $subscription->id,
                'subscription_addon_id' => $addon?->id,
                'check_in_at' => $checkIn,
                'check_out_at' => isset($data['check_out_at']) ? Carbon::parse($data['check_out_at']) : null,
                'status' => 'allowed',
                'alert_reason' => null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);
        });

        return $visit->load([
            'member.latestSubscription.plan',
            'subscription.plan',
            'subscriptionAddon.plan',
            'creator',
        ]);
    }
}
