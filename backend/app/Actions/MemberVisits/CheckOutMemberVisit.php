<?php

namespace App\Actions\MemberVisits;

use App\Actions\Attendance\ResolveAttendanceIdentity;
use App\Models\MemberVisit;
use App\Models\User;
use App\Support\Geofence;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

final class CheckOutMemberVisit
{
    public function __construct(
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
    ) {}

    public function handle(array $data, User $user): MemberVisit
    {
        $member = $this->identity->member($data);
        $checkOut = Carbon::parse($data['check_out_at'] ?? now());
        $visit = MemberVisit::query()
            ->where('member_id', $member->id)
            ->whereNull('check_out_at')
            ->latest('check_in_at')
            ->first();

        if (! $visit) {
            throw ValidationException::withMessages([
                'member_id' => 'No open visit found for this member.',
            ]);
        }

        $location = $this->geofence->evaluate($data);
        $status = $visit->status;
        $alert = $visit->alert_reason;
        if ($status === 'allowed' && $location['location_status'] === 'outside') {
            $status = 'flagged';
            $alert = 'Checkout location is outside the configured gym geofence.';
        }

        $visit->update([
            'check_out_at' => $checkOut,
            'check_out_latitude' => $location['latitude'],
            'check_out_longitude' => $location['longitude'],
            'check_out_accuracy_meters' => $location['accuracy_meters'],
            'check_out_distance_meters' => $location['distance_meters'],
            'check_out_location_status' => $location['location_status'],
            'status' => $status,
            'alert_reason' => $alert,
            'notes' => $data['notes'] ?? $visit->notes,
            'created_by' => $visit->created_by ?? $user->id,
        ]);

        return $visit->load(['member.latestSubscription.plan', 'subscription.plan', 'creator']);
    }
}
