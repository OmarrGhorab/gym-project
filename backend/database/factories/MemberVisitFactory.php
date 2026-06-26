<?php

namespace Database\Factories;

use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MemberVisit>
 */
class MemberVisitFactory extends Factory
{
    protected $model = MemberVisit::class;

    public function definition(): array
    {
        return [
            'member_id' => Member::factory(),
            'subscription_id' => null,
            'check_in_at' => now(),
            'check_out_at' => null,
            'status' => 'allowed',
            'alert_reason' => null,
            'notes' => null,
            'created_by' => User::factory(),
        ];
    }

    public function forSubscription(): static
    {
        return $this->state(fn (array $attributes) => [
            'subscription_id' => Subscription::factory(),
        ]);
    }
}
