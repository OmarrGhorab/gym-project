<?php

namespace Database\Factories;

use App\Models\AttendanceViolationRule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AttendanceViolationRule>
 */
class AttendanceViolationRuleFactory extends Factory
{
    protected $model = AttendanceViolationRule::class;

    public function definition(): array
    {
        return [
            'code' => fake()->unique()->slug(2),
            'name' => fake()->sentence(3),
            'description' => fake()->sentence(),
            'threshold_minutes' => 15,
            'deduction_days' => '0.25',
            'requires_admin_approval' => true,
            'auto_apply_if_unreviewed' => true,
            'is_active' => true,
        ];
    }
}
