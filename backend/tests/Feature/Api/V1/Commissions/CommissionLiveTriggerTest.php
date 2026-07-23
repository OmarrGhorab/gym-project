<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('creating a subscription for a linked employee captain automatically creates a pending plan commission', function (): void {
    $user = User::factory()->create();
    $employee = Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    $plan = Plan::factory()->create(['commission_rate' => '0.1000']);

    // Create a subscription sold by this user
    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
    ]);

    // Expect a commission record to exist
    $commission = Commission::where('source_type', Subscription::class)
        ->where('source_id', $subscription->id)
        ->first();

    expect($commission)->not->toBeNull();
    expect($commission->employee_id)->toBe($employee->id);
    expect($commission->rate)->toBe('0.1000');
    expect($commission->amount)->toBe('30.00'); // 10% of 300
    expect($commission->status)->toBe('pending');
    expect($commission->month)->toBe($subscription->created_at->format('Y-m')); // Wait, the format in tasks.md is char(7) YYYY-MM.
    // Let's verify: tasks.md line 11 says "month as char(7) YYYY-MM"
    // So format is YYYY-MM (e.g. $subscription->created_at->format('Y-m'))
});

test('plan level commission rate drives subscription commission', function (): void {
    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    // Plan has an override rate of 15%
    $plan = Plan::factory()->create(['commission_rate' => '0.1500']);

    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'plan_id' => $plan->id,
        'price_paid' => '200.00',
    ]);

    $commission = Commission::where('source_type', Subscription::class)
        ->where('source_id', $subscription->id)
        ->first();

    expect($commission)->not->toBeNull();
    expect($commission->rate)->toBe('0.1500');
    expect($commission->amount)->toBe('30.00'); // 15% of 200
});

test('creating a completed sale for a linked employee captain does not create commission without a commission plan', function (): void {
    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    $sale = Sale::factory()->create([
        'sold_by_user_id' => $user->id,
        'total' => '500.00',
        'status' => 'completed',
    ]);

    $commission = Commission::where('source_type', Sale::class)
        ->where('source_id', $sale->id)
        ->first();

    expect($commission)->toBeNull();
});

test('unlinked user transactions do not trigger commission creation', function (): void {
    $unlinkedUser = User::factory()->create();

    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $unlinkedUser->id,
        'price_paid' => '300.00',
    ]);

    $commission = Commission::where('source_type', Subscription::class)
        ->where('source_id', $subscription->id)
        ->first();

    expect($commission)->toBeNull();
});

test('employee selling or renewing subscription defaults to 1% commission when plan rate is unconfigured', function (): void {
    $user = User::factory()->create();
    $employee = Employee::factory()->create([
        'role' => 'cashier',
        'user_id' => $user->id,
        'base_salary' => '5000.00',
    ]);

    $plan = Plan::factory()->create(['commission_rate' => null]);

    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'plan_id' => $plan->id,
        'price_paid' => '1000.00',
    ]);

    $commission = Commission::where('source_type', Subscription::class)
        ->where('source_id', $subscription->id)
        ->first();

    expect($commission)->not->toBeNull();
    expect($commission->employee_id)->toBe($employee->id);
    expect($commission->rate)->toBe('0.0100');
    expect($commission->amount)->toBe('10.00');
});
