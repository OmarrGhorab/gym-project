<?php

namespace Database\Factories;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;

class PaymentFactory extends Factory
{
    protected $model = Payment::class;

    public function definition(): array
    {
        return [
            'amount' => '100.00',
            'method' => 'cash',
            'status' => 'paid',
            'paid_at' => now(),
            'due_date' => null,
            'created_by' => null,
        ];
    }

    public function partial(): static
    {
        return $this->state(['status' => 'partial']);
    }

    public function due(): static
    {
        return $this->state([
            'status' => 'due',
            'paid_at' => null,
            'due_date' => now()->toDateString(),
        ]);
    }
}
