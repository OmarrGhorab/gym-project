<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $price = $this->faker->randomFloat(2, 10, 500);
        $cost = $price * 0.6; // 60% margin

        return [
            'name' => $this->faker->words(2, true),
            'category' => $this->faker->randomElement(['drinks', 'supplements', 'accessories', 'apparel']),
            'sku' => strtoupper($this->faker->unique()->lexify('SKU-??????')),
            'price' => $price,
            'cost' => round($cost, 2),
            'stock_quantity' => $this->faker->numberBetween(0, 100),
            'low_stock_threshold' => 5,
            'image' => null,
            'is_active' => true,
        ];
    }

    public function active(): static
    {
        return $this->state(['is_active' => true]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }

    public function lowStock(): static
    {
        return $this->state([
            'stock_quantity' => 2,
            'low_stock_threshold' => 5,
        ]);
    }
}
