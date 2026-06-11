<?php

namespace Database\Factories;

use App\Models\Expense;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Expense>
 */
class ExpenseFactory extends Factory
{
    protected $model = Expense::class;

    public function definition(): array
    {
        return [
            'category' => fake()->randomElement(['rent', 'utilities', 'equipment', 'payroll', 'marketing', 'maintenance']),
            'amount' => fake()->randomFloat(2, 50, 5000),
            'description' => fake()->sentence(),
            'date' => fake()->date(),
            'created_by' => User::factory(),
        ];
    }
}
