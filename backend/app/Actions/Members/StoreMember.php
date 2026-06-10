<?php

namespace App\Actions\Members;

use App\Models\Member;
use App\Models\User;

final class StoreMember
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $creator): Member
    {
        return Member::create([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
            'gender' => $data['gender'] ?? null,
            'birth_date' => $data['birth_date'] ?? null,
            'national_id' => $data['national_id'] ?? null,
            'join_date' => $data['join_date'] ?? now()->toDateString(),
            'status' => 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $creator->id,
        ]);
    }
}
