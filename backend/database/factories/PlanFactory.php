<?php

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Plan>
 */
final class PlanFactory extends Factory
{
    protected $model = Plan::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->words(3, true),
            'description' => $this->faker->optional()->sentence(),
            'price' => $this->faker->randomFloat(2, 50, 1000),
            'duration_days' => $this->faker->numberBetween(7, 365),
            'sessions_count' => $this->faker->optional()->numberBetween(4, 50),
            'type' => $this->faker->randomElement(['membership', 'offer']),
            'is_active' => true,
            'valid_from' => null,
            'valid_to' => null,
            'max_freeze_days' => 0,
        ];
    }

    public function active(): static
    {
        return $this->state(['is_active' => true, 'valid_from' => null, 'valid_to' => null]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }

    public function expiredWindow(): static
    {
        return $this->state([
            'is_active' => true,
            'valid_from' => '2025-01-01',
            'valid_to' => '2025-12-31',
        ]);
    }
}
