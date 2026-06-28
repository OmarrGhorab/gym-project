<?php

namespace App\Actions\MemberVisits;

use App\Actions\Attendance\ResolveAttendanceIdentity;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Geofence;
use Illuminate\Support\Carbon;

final class CheckInMemberVisit
{
    public function __construct(
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
    ) {}

    public function handle(array $data, User $user): MemberVisit
    {
        $checkIn = Carbon::parse($data['check_in_at'] ?? now());
        $member = $this->identity->member($data);
        $subscription = $this->activeSubscription($member, $checkIn);
        $location = $this->geofence->evaluate($data);
        $subscriptionStatus = $subscription ? 'allowed' : 'blocked';
        $status = $subscriptionStatus === 'allowed' && $location['location_status'] === 'outside'
            ? 'flagged'
            : $subscriptionStatus;

        $visit = MemberVisit::create([
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
            'alert_reason' => $this->alertReason($member, $checkIn, $subscription, $location['location_status']),
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return $visit->load(['member.latestSubscription.plan', 'subscription.plan', 'creator']);
    }

    private function activeSubscription(Member $member, Carbon $checkIn): ?Subscription
    {
        return $member->subscriptions()
            ->where('status', 'active')
            ->whereDate('start_date', '<=', $checkIn->toDateString())
            ->whereDate('end_date', '>=', $checkIn->toDateString())
            ->latest('end_date')
            ->first();
    }

    private function alertReason(Member $member, Carbon $checkIn, ?Subscription $subscription, ?string $locationStatus): ?string
    {
        if ($locationStatus === 'outside') {
            return 'Visit location is outside the configured gym geofence.';
        }

        if ($subscription) {
            return null;
        }

        $latest = $member->latestSubscription;

        if (! $latest) {
            return 'No subscription found.';
        }

        if ($latest->status !== 'active') {
            return "Subscription is {$latest->status}.";
        }

        if ($latest->end_date?->lt($checkIn)) {
            return 'Subscription is expired.';
        }

        return 'No active subscription covers this visit date.';
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
