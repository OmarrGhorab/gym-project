<?php

namespace Database\Factories;

use App\Models\Employee;
use App\Models\Payroll;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payroll>
 */
class PayrollFactory extends Factory
{
    protected $model = Payroll::class;

    public function definition(): array
    {
        return [
            'employee_id' => Employee::factory(),
            'month' => now()->format('Y-m'),
            'base_salary' => 3000.00,
            'commissions_total' => 200.00,
            'bonuses' => 0.00,
            'deductions' => 0.00,
            'net_salary' => 3200.00,
            'status' => 'pending',
            'paid_at' => null,
        ];
    }

    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'paid',
            'paid_at' => now(),
        ]);
    }
}
