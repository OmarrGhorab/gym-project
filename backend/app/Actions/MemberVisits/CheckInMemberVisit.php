<?php

namespace App\Actions\MemberVisits;

use App\Actions\Attendance\ResolveAttendanceIdentity;
use App\Models\MemberVisit;
use App\Models\Setting;
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
            $openVisit = MemberVisit::query()->where('member_id', $member->id)->whereNull('check_out_at')->latest('check_in_at')->lockForUpdate()->first();
            if ($openVisit) {
                // A scan seconds after the last one is the same badge being read
                // twice — a scanner repeat, or someone tapping again because nothing
                // seemed to happen. Recording it at all is what buried the desk in
                // questions, so it is not recorded: the existing visit is returned
                // untouched and nothing is asked.
                if ($openVisit->check_in_at->diffInSeconds($checkIn) < $this->graceSeconds()) {
                    return $openVisit;
                }

                // One question at a time. A member who keeps scanning while the desk
                // has not answered yet must not queue up a second identical decision.
                if ($openVisit->status === 'pending_review') {
                    return $openVisit;
                }

                // The first visit is left exactly as it is: it already happened, and
                // it is the one the member is standing in the gym on. Reversing and
                // refunding it here meant that dismissing the duplicate handed back a
                // session the member had genuinely used, and left their real visit
                // flagged. Only the desk's decision on the new scan may change money.
                return MemberVisit::create([
                    'member_id' => $member->id,
                    'subscription_id' => $openVisit->subscription_id,
                    'subscription_addon_id' => $openVisit->subscription_addon_id,
                    'check_in_at' => $checkIn,
                    'check_in_latitude' => $location['latitude'],
                    'check_in_longitude' => $location['longitude'],
                    'check_in_accuracy_meters' => $location['accuracy_meters'],
                    'check_in_distance_meters' => $location['distance_meters'],
                    'check_in_location_status' => $location['location_status'],
                    'status' => 'pending_review',
                    'scan_method' => $this->scanMethod($data),
                    'alert_reason' => 'Already checked in today. Approve only if the member really came back — it counts a second visit and uses another session. Dismiss if the badge was scanned twice.',
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $user->id,
                ]);
            }

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

    /**
     * How long after a scan another scan is treated as the same one.
     *
     * Two minutes covers a scanner repeat and a member tapping again, while
     * staying far below any believable "left and came straight back".
     */
    private function graceSeconds(): int
    {
        $minutes = Setting::query()->where('key', 'attendance.duplicate_scan_grace_minutes')->first()?->value;

        return (int) round(max(0, is_numeric($minutes) ? (float) $minutes : 2.0) * 60);
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
