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
            'birth_date' => $data['birth_date'] ?? null,
            'national_id' => $data['national_id'] ?? null,
            'join_date' => $data['join_date'] ?? $member->join_date,
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'] ?? $member->status,
        ]);

        return $member->fresh();
    }
}
