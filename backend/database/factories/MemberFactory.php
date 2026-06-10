<?php

namespace Database\Factories;

use App\Models\Member;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Member>
 */
class MemberFactory extends Factory
{
    protected $model = Member::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'phone' => fake()->unique()->numerify('+201#########'),
            'email' => fake()->unique()->optional(0.7)->safeEmail(),
            'gender' => fake()->randomElement(['male', 'female', null]),
            'birth_date' => fake()->optional()->date(),
            'photo_path' => null,
            'national_id' => fake()->unique()->optional(0.5)->numerify('##############'),
            'join_date' => now()->toDateString(),
            'status' => 'active',
            'notes' => null,
            'created_by' => null,
        ];
    }

    public function inactive(): static
    {
        return $this->state(['status' => 'inactive']);
    }

    public function active(): static
    {
        return $this->state(['status' => 'active']);
    }
}
