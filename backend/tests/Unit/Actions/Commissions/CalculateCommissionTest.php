<?php

use App\Actions\Commissions\CalculateCommission;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
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
    Commission::query()->delete();

    $created = app(CalculateCommission::class)->forSource($sale);
    $commission = Commission::query()->first();

    expect($created)->toBe(1)
        ->and($commission)->not->toBeNull()
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

    $created = app(CalculateCommission::class)->forSource($sale);

    expect($created)->toBe(0)
        ->and(Commission::query()->count())->toBe(0);
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
    Commission::query()->delete();

    $created = app(CalculateCommission::class)->forSource($subscription);
    $commission = Commission::query()->first();

    expect($created)->toBe(1)
        ->and($commission)->not->toBeNull()
        ->and($commission->rate)->toBe('0.1200')
        ->and($commission->amount)->toBe('60.00');
});

test('it calculates coach commission for subscription add ons', function (): void {
    $coach = Employee::factory()->create([
        'role' => 'coach',
        'status' => 'active',
    ]);
    $member = App\Models\Member::factory()->active()->create();
    $basePlan = Plan::factory()->create(['category' => 'gym_access']);
    $servicePlan = Plan::factory()->create(['category' => 'personal_training']);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
    ]);
    $addon = SubscriptionAddon::create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $servicePlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-07-07',
        'end_date' => '2026-08-07',
        'status' => 'active',
        'price_paid' => '1000.00',
    ]);
    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $servicePlan->id,
        'calculation_type' => 'percentage',
        'value' => '15.0000',
        'is_active' => true,
    ]);

    $created = app(CalculateCommission::class)->forSource($addon);
    $commission = Commission::query()->first();

    expect($created)->toBe(1)
        ->and($commission)->not->toBeNull()
        ->and($commission->employee_id)->toBe($coach->id)
        ->and($commission->commission_type)->toBe('subscription_addon_coach')
        ->and($commission->amount)->toBe('150.00');
});
