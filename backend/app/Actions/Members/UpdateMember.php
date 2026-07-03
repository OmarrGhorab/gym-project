<?php

namespace App\Actions\Members;

use App\Models\Member;

final class UpdateMember
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Member $member, array $data): Member
    {
        $member->update([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'gender' => $data['gender'] ?? null,
            'national_id' => $data['national_id'] ?? null,
            'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
            'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
            'join_date' => $data['join_date'] ?? $member->join_date,
            'notes' => $data['notes'] ?? null,
            'goals' => $data['goals'] ?? null,
            'injuries' => $data['injuries'] ?? null,
            'medical_notes' => $data['medical_notes'] ?? null,
            'tags' => $data['tags'] ?? null,
            'coach_id' => $data['coach_id'] ?? null,
            'status' => $data['status'] ?? $member->status,
        ]);

        return $member->fresh(['latestSubscription.plan', 'coach']) ?? $member;
    }
}
