<?php

namespace Database\Factories;

use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

class SubscriptionFactory extends Factory
{
    protected $model = Subscription::class;

    public function definition(): array
    {
        $start = Carbon::today();

        return [
            'member_id' => Member::factory(),
            'plan_id' => Plan::factory(),
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDays(30)->toDateString(),
            'status' => 'active',
            'price_paid' => '300.00',
            'discount' => '0.00',
            'sold_by_user_id' => User::factory(),
            'created_by' => null,
            'last_reminded_on' => null,
        ];
    }

    public function active(): static
    {
        return $this->state(['status' => 'active']);
    }

    public function expiringSoon(): static
    {
        return $this->state([
            'status' => 'active',
            'end_date' => Carbon::today()->addDays(3)->toDateString(),
        ]);
    }

    public function expired(): static
    {
        return $this->state([
            'status' => 'expired',
            'end_date' => Carbon::today()->subDay()->toDateString(),
        ]);
    }

    public function frozen(): static
    {
        return $this->state(['status' => 'frozen']);
    }

    public function stopped(): static
    {
        return $this->state(['status' => 'stopped']);
    }
}
