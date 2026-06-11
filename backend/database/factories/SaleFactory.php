<?php

namespace Database\Factories;

use App\Models\Member;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sale>
 */
class SaleFactory extends Factory
{
    protected $model = Sale::class;

    public function definition(): array
    {
        $subtotal = $this->faker->randomFloat(2, 20, 1000);

        return [
            'idempotency_key' => $this->faker->unique()->uuid(),
            'member_id' => Member::factory(),
            'sold_by_user_id' => User::factory(),
            'subtotal' => $subtotal,
            'discount' => 0.00,
            'total' => $subtotal,
            'payment_method' => $this->faker->randomElement(['cash', 'card', 'bank_transfer']),
            'status' => 'completed',
            'notes' => $this->faker->optional()->sentence(),
        ];
    }

    public function voided(): static
    {
        return $this->state(['status' => 'voided']);
    }
}
