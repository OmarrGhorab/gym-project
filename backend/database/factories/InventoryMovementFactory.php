<?php

namespace Database\Factories;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryMovement>
 */
class InventoryMovementFactory extends Factory
{
    protected $model = InventoryMovement::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'type' => $this->faker->randomElement(['in', 'out', 'adjust']),
            'quantity' => $this->faker->numberBetween(-20, 20),
            'reason' => $this->faker->sentence(),
            'created_by' => User::factory(),
        ];
    }
}
