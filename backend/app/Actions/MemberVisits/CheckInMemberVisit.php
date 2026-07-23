<?php

namespace App\Actions\MemberVisits;

use App\Actions\Attendance\ResolveAttendanceIdentity;
use App\Models\MemberVisit;
use App\Models\User;
use App\Support\Geofence;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CheckInMemberVisit
{
    public function __construct(
        private readonly AutoCloseStaleMemberVisits $autoCloseStaleVisits,
        private readonly EnsureMemberCanCheckIn $ensureMemberCanCheckIn,
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
            $this->ensureMemberCanCheckIn->handle($member);

            // Hard-deny outside membership access window / no sessions / expired / inactive.
            $subscription = $this->visitSubscription->consume($member, $checkIn);

            $addonId = isset($data['subscription_addon_id']) ? (int) $data['subscription_addon_id'] : 0;
            $addon = null;
            if ($addonId > 0) {
                $addon = $this->visitSubscription->consumeAddon($member, $checkIn, $addonId);
            } else {
                $addon = $this->visitSubscription->autoConsumeActiveAddon($member, $checkIn, $subscription);
            }

            $status = $location['location_status'] === 'outside' ? 'flagged' : 'allowed';

            return MemberVisit::create([
                'member_id' => $member->id,
                'subscription_id' => $subscription->id,
                'subscription_addon_id' => $addon?->id,
                'check_in_at' => $checkIn,
                'check_in_latitude' => $location['latitude'],
                'check_in_longitude' => $location['longitude'],
                'check_in_accuracy_meters' => $location['accuracy_meters'],
                'check_in_distance_meters' => $location['distance_meters'],
                'check_in_location_status' => $location['location_status'],
                'status' => $status,
                'scan_method' => $this->scanMethod($data),
                'alert_reason' => $status === 'flagged'
                    ? 'Visit location is outside the configured gym geofence.'
                    : null,
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

    private function scanMethod(array $data): string
    {
        $requested = strtolower(trim((string) ($data['scan_method'] ?? '')));

        if (in_array($requested, ['qr', 'scanner', 'manual', 'phone', 'name', 'member_id'], true)) {
            return $requested;
        }

        if (! empty($data['qr_token'])) {
            return 'qr';
        }
        if (! empty($data['phone'])) {
            return 'phone';
        }
        if (! empty($data['name'])) {
            return 'name';
        }
        if (! empty($data['member_id'])) {
            return 'member_id';
        }

        return 'manual';
    }
}
