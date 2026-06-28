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
            'shift_id' => null,
            'date' => fake()->date(),
            'check_in' => '09:00',
            'check_out' => '17:00',
            'status' => 'present',
            'scan_method' => 'manual',
            'schedule_status' => 'on_shift',
            'approval_status' => 'approved',
            'late_minutes' => 0,
            'early_leave_minutes' => 0,
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
