<?php

namespace Database\Factories;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Sale;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Commission>
 */
class CommissionFactory extends Factory
{
    protected $model = Commission::class;

    public function definition(): array
    {
        return [
            'employee_id' => Employee::factory(),
            'source_type' => Sale::class,
            'source_id' => Sale::factory(),
            'rate' => 0.1000,
            'amount' => 50.00,
            'month' => now()->format('Y-m'),
            'status' => 'pending',
        ];
    }

    public function paid(): static
    {
        return $this->state(['status' => 'paid']);
    }
}
