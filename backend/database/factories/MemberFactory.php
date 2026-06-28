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
        $mobilePrefix = fake()->randomElement(['0', '1', '2', '5']);

        return [
            'name' => fake()->name(),
            'phone' => fake()->unique()->numerify("+201{$mobilePrefix}########"),
            'email' => fake()->unique()->optional(0.7)->safeEmail(),
            'gender' => fake()->randomElement(['male', 'female', null]),
            'photo_path' => null,
            'national_id' => fake()->unique()->optional(0.5)->numerify(fake()->randomElement(['2', '3']).'#############'),
            'attendance_code' => null,
            'birth_date' => fake()->boolean(60)
                ? fake()->dateTimeBetween('-50 years', '-16 years')->format('Y-m-d')
                : null,
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
