<?php

namespace App\Actions\Members;

use App\Actions\Subscriptions\CreateSubscription;
use App\Models\Member;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class StoreMember
{
    public function __construct(
        private readonly CreateSubscription $createSubscription,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $creator): Member
    {
        return DB::transaction(function () use ($data, $creator): Member {
            $member = Member::create([
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

            if (isset($data['subscription']) && is_array($data['subscription'])) {
                $subscriptionData = $data['subscription'];
                $subscriptionData['member_id'] = $member->id;

                $this->createSubscription->handle($subscriptionData, $creator);
            }

            return $member->fresh(['latestSubscription.plan']) ?? $member;
        });
    }
}
