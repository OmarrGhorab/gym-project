<?php

use App\Actions\Commissions\CalculateCommission;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('it resolves employee default rate and calculates commission amount', function (): void {
    $user = User::factory()->create();
    $employee = Employee::factory()->captain()->create([
        'user_id' => $user->id,
        'commission_rate' => 0.1000,
    ]);

    $sale = Sale::factory()->create([
        'sold_by_user_id' => $user->id,
        'total' => 350.00,
    ]);

    $commission = app(CalculateCommission::class)->forSource($sale);

    expect($commission)->not->toBeNull()
        ->and($commission->employee_id)->toBe($employee->id)
        ->and($commission->rate)->toBe('0.1000')
        ->and($commission->amount)->toBe('35.00');
});

test('it skips calculation when user is not linked to employee', function (): void {
    $user = User::factory()->create();

    $sale = Sale::factory()->create([
        'sold_by_user_id' => $user->id,
        'total' => 350.00,
    ]);

    $commission = app(CalculateCommission::class)->forSource($sale);

    expect($commission)->toBeNull();
});

test('it resolves plan override rate for subscriptions', function (): void {
    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
        'commission_rate' => 0.1000,
    ]);

    $plan = Plan::factory()->create([
        'commission_rate' => 0.1200,
    ]);

    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'plan_id' => $plan->id,
        'price_paid' => 500.00,
    ]);

    $commission = app(CalculateCommission::class)->forSource($subscription);

    expect($commission)->not->toBeNull()
        ->and($commission->rate)->toBe('0.1200')
        ->and($commission->amount)->toBe('60.00');
});
