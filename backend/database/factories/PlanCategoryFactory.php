<?php

namespace Database\Factories;

use App\Models\PlanCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PlanCategory>
 */
final class PlanCategoryFactory extends Factory
{
    protected $model = PlanCategory::class;

    public function definition(): array
    {
        $name = $this->faker->unique()->words(2, true);

        return [
            'name' => Str::title($name),
            'slug' => PlanCategory::slugFor($name),
            'description' => $this->faker->optional()->sentence(),
            'plan_type' => 'membership',
            'is_active' => true,
            'is_system' => false,
        ];
    }

    public function forType(string $type): static
    {
        return $this->state(['plan_type' => $type]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
