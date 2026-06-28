<?php

namespace Database\Factories;

use App\Models\EmployeeShift;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmployeeShift>
 */
class EmployeeShiftFactory extends Factory
{
    protected $model = EmployeeShift::class;

    public function definition(): array
    {
        return [
            'name' => 'Morning Shift',
            'starts_at' => '09:00',
            'ends_at' => '17:00',
            'grace_minutes' => 15,
            'is_active' => true,
        ];
    }
}
