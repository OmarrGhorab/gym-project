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
            $status = $subscription ? 'allowed' : 'blocked';

            return MemberVisit::create([
                'member_id' => $member->id,
                'subscription_id' => $subscription?->id,
                'check_in_at' => $checkIn,
                'check_out_at' => isset($data['check_out_at']) ? Carbon::parse($data['check_out_at']) : null,
                'status' => $status,
                'alert_reason' => $status === 'blocked' ? $this->visitSubscription->alertReason($member, $checkIn) : null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);
        });

        return $visit->load(['member.latestSubscription.plan', 'subscription.plan', 'creator']);
    }
}
