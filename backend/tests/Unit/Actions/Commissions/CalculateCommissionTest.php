<?php

use App\Actions\Commissions\CalculateCommission;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('it skips pos sales because they do not have a commission plan', function (): void {
    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    $sale = Sale::factory()->create([
        'sold_by_user_id' => $user->id,
        'total' => 350.00,
    ]);
    Commission::query()->delete();

    $created = app(CalculateCommission::class)->forSource($sale);

    expect($created)->toBe(0)
        ->and(Commission::query()->count())->toBe(0);
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

test('it resolves plan commission rate for subscriptions', function (): void {
    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
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

test('it skips subscription seller commission when the plan pays a zero commission rate', function (): void {
    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    // An explicitly configured 0% plan pays no sales commission. (A plan with a
    // *null* rate is merely unconfigured and falls back to the default 1%, see
    // tests/Feature/Api/V1/Commissions/CommissionLiveTriggerTest.php.)
    $plan = Plan::factory()->create([
        'commission_rate' => '0.0000',
    ]);

    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'plan_id' => $plan->id,
        'price_paid' => 500.00,
    ]);
    Commission::query()->delete();

    $created = app(CalculateCommission::class)->forSource($subscription);

    expect($created)->toBe(0)
        ->and(Commission::query()->count())->toBe(0);
});

test('it falls back to the default one percent seller rate when the plan rate is unconfigured', function (): void {
    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    $plan = Plan::factory()->create([
        'commission_rate' => null,
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
        ->and($commission->rate)->toBe('0.0100')
        ->and($commission->amount)->toBe('5.00');
});

test('it calculates percentage coach commission for subscription add ons from subscription plus add on total', function (): void {
    $coach = Employee::factory()->create([
        'role' => 'coach',
        'status' => 'active',
    ]);
    $member = Member::factory()->active()->create();
    $basePlan = Plan::factory()->create(['category' => 'gym_access']);
    $servicePlan = Plan::factory()->create(['category' => 'personal_training']);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
        'price_paid' => '500.00',
    ]);
    $addon = SubscriptionAddon::create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $servicePlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-07-07',
        'end_date' => '2026-08-07',
        'status' => 'active',
        'price_paid' => '300.00',
    ]);
    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $servicePlan->id,
        'calculation_type' => 'percentage',
        'value' => '50.0000',
        'is_active' => true,
    ]);

    $created = app(CalculateCommission::class)->forSource($addon);
    $commission = Commission::query()->first();

    expect($created)->toBe(1)
        ->and($commission)->not->toBeNull()
        ->and($commission->employee_id)->toBe($coach->id)
        ->and($commission->commission_type)->toBe('subscription_addon_coach')
        ->and($commission->amount)->toBe('400.00');
});

test('it calculates package-included coach commission from the included service list price', function (): void {
    $coach = Employee::factory()->create([
        'role' => 'coach',
        'status' => 'active',
    ]);
    $member = Member::factory()->active()->create();
    $packagePlan = Plan::factory()->create([
        'type' => 'offer_package',
        'category' => 'gym_access',
        'price' => '1500.00',
    ]);
    $servicePlan = Plan::factory()->create([
        'category' => 'nutrition',
        'price' => '300.00',
    ]);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $packagePlan->id,
        'price_paid' => '1500.00',
    ]);
    $addon = SubscriptionAddon::create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $servicePlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-07-07',
        'end_date' => '2026-08-07',
        'status' => 'active',
        'price_paid' => '0.00',
        'discount' => '300.00',
    ]);
    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $servicePlan->id,
        'calculation_type' => 'percentage',
        'value' => '50.0000',
        'is_active' => true,
    ]);

    $created = app(CalculateCommission::class)->forSource($addon->fresh(['plan', 'subscription', 'coach.planCommissionRules']) ?? $addon);
    $commission = Commission::query()->first();

    expect($created)->toBe(1)
        ->and($commission)->not->toBeNull()
        ->and($commission->employee_id)->toBe($coach->id)
        ->and($commission->commission_type)->toBe('subscription_addon_coach')
        ->and($commission->amount)->toBe('150.00');
});

test('only the coach the member subscribed with earns commission on a multi coach plan', function (): void {
    $member = Member::factory()->create();
    $chosenCoach = Employee::factory()->captain()->create();
    $otherCoach = Employee::factory()->captain()->create();
    // No seller rate, so the only commissions in play are the coach ones.
    $plan = Plan::factory()->create([
        'category' => 'nutrition',
        'price' => '350.00',
        'commission_rate' => 0,
    ]);

    // Both coaches are offered on the plan at 50% — they are alternatives the
    // member picks between, not co-earners who split or stack the payout.
    foreach ([$chosenCoach, $otherCoach] as $coach) {
        EmployeePlanCommissionRule::create([
            'employee_id' => $coach->id,
            'plan_id' => $plan->id,
            'calculation_type' => 'percentage',
            'value' => '50.0000',
            'is_active' => true,
        ]);
    }

    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'coach_id' => $chosenCoach->id,
        'sold_by_user_id' => null,
        'price_paid' => '350.00',
    ]);
    Commission::query()->delete();

    $created = app(CalculateCommission::class)->forSource($subscription);
    $commissions = Commission::query()->get();

    expect($created)->toBe(1)
        ->and($commissions)->toHaveCount(1)
        ->and($commissions->first()->employee_id)->toBe($chosenCoach->id)
        ->and($commissions->first()->amount)->toBe('175.00')
        ->and($commissions->where('employee_id', $otherCoach->id))->toHaveCount(0);
});
