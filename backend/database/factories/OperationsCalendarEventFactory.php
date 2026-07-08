<?php

namespace Database\Factories;

use App\Models\OperationsCalendarEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OperationsCalendarEvent>
 */
class OperationsCalendarEventFactory extends Factory
{
    protected $model = OperationsCalendarEvent::class;

    public function definition(): array
    {
        return [
            'date' => now()->toDateString(),
            'title' => fake()->sentence(3),
            'type' => 'manual',
            'custom_type_label' => null,
            'notes' => null,
            'assigned_employee_ids' => null,
            'created_by' => User::factory(),
        ];
    }
}
