<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Attendance>
 */
class AttendanceFactory extends Factory
{
    protected $model = Attendance::class;

    public function definition(): array
    {
        return [
            'employee_id' => Employee::factory(),
            'date' => fake()->date(),
            'check_in' => '09:00',
            'check_out' => '17:00',
            'status' => 'present',
            'notes' => null,
        ];
    }

    public function absent(): static
    {
        return $this->state(fn (array $attributes) => [
            'check_in' => null,
            'check_out' => null,
            'status' => 'absent',
        ]);
    }
}
