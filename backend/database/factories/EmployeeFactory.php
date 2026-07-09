<?php

namespace Database\Factories;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Employee>
 */
class EmployeeFactory extends Factory
{
    protected $model = Employee::class;

    public function definition(): array
    {
        return [
            'user_id' => null, // defaults to unlinked
            'name' => fake()->name(),
            'phone' => fake()->phoneNumber(),
            'attendance_code' => null,
            'role' => 'employee',
            'base_salary' => 3000.00,
            'shift_id' => null,
            'hire_date' => fake()->date(),
            'status' => 'active',
        ];
    }

    public function captain(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'captain',
            'base_salary' => 4000.00,
        ]);
    }

    public function manager(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'manager',
            'base_salary' => 6000.00,
        ]);
    }

    public function linked(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => User::factory(),
        ]);
    }
}
