<?php

namespace Database\Factories;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AttendanceViolation>
 */
class AttendanceViolationFactory extends Factory
{
    protected $model = AttendanceViolation::class;

    public function definition(): array
    {
        return [
            'employee_id' => Employee::factory(),
            'attendance_id' => Attendance::factory(),
            'attendance_violation_rule_id' => AttendanceViolationRule::factory(),
            'payroll_id' => null,
            'violation_date' => now()->toDateString(),
            'type' => 'late',
            'minutes' => 30,
            'deduction_days' => '0.25',
            'deduction_amount' => '0.00',
            'status' => 'pending',
            'notes' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
        ];
    }
}
