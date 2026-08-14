<?php

namespace Database\Factories;

use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFreezeFactory extends Factory
{
    protected $model = SubscriptionFreeze::class;

    public function definition(): array
    {
        return [
            'subscription_id' => Subscription::factory(),
            'freeze_start' => now()->toDateString(),
            'freeze_end' => now()->addDays(2)->toDateString(),
            'days' => 3,
            'reason' => fake()->sentence(),
            'created_by' => User::factory(),
            'approval_status' => SubscriptionFreeze::APPROVAL_NOT_REQUIRED,
        ];
    }
}
