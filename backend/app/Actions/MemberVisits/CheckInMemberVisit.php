<?php

namespace App\Actions\MemberVisits;

use App\Actions\Attendance\ResolveAttendanceIdentity;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\User;
use App\Support\Geofence;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CheckInMemberVisit
{
    public function __construct(
        private readonly AutoCloseStaleMemberVisits $autoCloseStaleVisits,
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
        private readonly ResolveMemberVisitSubscription $visitSubscription,
    ) {}

    public function handle(array $data, User $user): MemberVisit
    {
        $checkIn = Carbon::parse($data['check_in_at'] ?? now());
        $member = $this->identity->member($data);
        $location = $this->geofence->evaluate($data);

        $visit = DB::transaction(function () use ($data, $user, $checkIn, $member, $location): MemberVisit {
            $this->autoCloseStaleVisits->handle($checkIn);

            $subscription = $this->visitSubscription->consume($member, $checkIn);
            $subscriptionStatus = $subscription ? 'allowed' : 'blocked';
            $status = $subscriptionStatus === 'allowed' && $location['location_status'] === 'outside'
                ? 'flagged'
                : $subscriptionStatus;

            return MemberVisit::create([
                'member_id' => $member->id,
                'subscription_id' => $subscription?->id,
                'check_in_at' => $checkIn,
                'check_in_latitude' => $location['latitude'],
                'check_in_longitude' => $location['longitude'],
                'check_in_accuracy_meters' => $location['accuracy_meters'],
                'check_in_distance_meters' => $location['distance_meters'],
                'check_in_location_status' => $location['location_status'],
                'status' => $status,
                'scan_method' => $this->scanMethod($data),
                'alert_reason' => $this->alertReason($member, $checkIn, $subscription !== null, $location['location_status']),
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);
        });

        return $visit->load(['member.latestSubscription.plan', 'subscription.plan', 'creator']);
    }

    private function alertReason(Member $member, Carbon $checkIn, bool $hasSubscription, ?string $locationStatus): ?string
    {
        if ($locationStatus === 'outside') {
            return 'Visit location is outside the configured gym geofence.';
        }

        if ($hasSubscription) {
            return null;
        }

        return $this->visitSubscription->alertReason($member, $checkIn);
    }

    private function scanMethod(array $data): string
    {
        if (! empty($data['qr_token'])) {
            return 'qr';
        }
        if (! empty($data['phone'])) {
            return 'phone';
        }
        if (! empty($data['name'])) {
            return 'name';
        }

        return 'manual';
    }
}
