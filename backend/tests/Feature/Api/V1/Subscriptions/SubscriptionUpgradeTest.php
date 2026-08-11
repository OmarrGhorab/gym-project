<?php

use App\Models\Employee;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('admin can switch main plan to a fitness studio plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $mainPlan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
        'category' => 'gym_access',
    ]);
    $studioPlan = Plan::factory()->active()->create([
        'price' => '1800.00',
        'duration_days' => 30,
        'category' => 'fitness_studio',
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $mainPlan->id,
        'price_paid' => '300.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    $response = $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $studioPlan->id,
        'payment' => ['amount' => '1500.00', 'method' => 'cash'],
    ])->assertStatus(201);
});

test('admin can add an extra service plan without changing the main membership', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $mainPlan = Plan::factory()->active()->create([
        'price' => '650.00',
        'duration_days' => 30,
        'category' => 'gym_access',
    ]);
    $ptPlan = Plan::factory()->active()->create([
        'price' => '1800.00',
        'duration_days' => 30,
        'category' => 'personal_training',
        'sessions_count' => 8,
        'is_unlimited_sessions' => false,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $mainPlan->id,
        'price_paid' => '650.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/addons", [
        'plan_id' => $ptPlan->id,
        'payment' => ['amount' => '1800.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.plan.id', $mainPlan->id)
        ->assertJsonPath('data.addons.0.plan.id', $ptPlan->id);

    expect($subscription->fresh()->plan_id)->toBe($mainPlan->id)
        ->and($subscription->addons()->count())->toBe(1);
});

test('admin can upgrade a subscription with full plan price difference by default', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();

    $basicPlan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
        'category' => 'gym_access',
    ]);

    $vipPlan = Plan::factory()->active()->create([
        'price' => '600.00',
        'duration_days' => 30,
        'duration_months' => 1,
        'category' => 'gym_access',
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-01 10:00:00',
    ]);

    // Full difference: 600 - 300 paid credit = 300.00 due
    $response = $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.plan.id', $vipPlan->id)
        ->assertJsonPath('data.start_date', '2026-06-10')
        ->assertJsonPath('data.end_date', '2026-07-10')
        ->assertJsonPath('data.days_left', 30)
        ->assertJsonPath('data.price_paid', '600.00')
        ->assertJsonPath('data.paid_total', '600.00');

    $newSubscriptionId = $response->json('data.id');
    expect(Payment::query()
        ->where('payable_type', Subscription::class)
        ->where('payable_id', $newSubscriptionId)
        ->revenue()
        ->sum('amount'))->toEqual('300.00')
        ->and(Payment::query()
            ->where('payable_type', Subscription::class)
            ->where('payable_id', $newSubscriptionId)
            ->where('status', Payment::STATUS_CREDIT)
            ->sum('amount'))->toEqual('300.00');

    $subscription->refresh();
    expect($subscription->status)->toBe('stopped')
        ->and(Subscription::count())->toBe(2);
});

test('admin can upgrade a subscription to a new plan with day-prorated credit', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();

    $basicPlan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
        'category' => 'gym_access',
    ]);

    $vipPlan = Plan::factory()->active()->create([
        'price' => '600.00',
        'duration_days' => 30,
        'duration_months' => 1,
        'category' => 'gym_access',
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-01 10:00:00',
    ]);

    // 9 of 30 days used -> 21 remaining -> 210.00 credit
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'credit_mode' => 'day_proration',
        'payment' => [
            'amount' => '390.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.plan.id', $vipPlan->id)
        ->assertJsonPath('data.start_date', '2026-06-10')
        ->assertJsonPath('data.end_date', '2026-07-10')
        ->assertJsonPath('data.days_left', 30)
        ->assertJsonPath('data.price_paid', '600.00')
        ->assertJsonPath('data.paid_total', '600.00');

    $subscription->refresh();
    expect($subscription->status)->toBe('stopped')
        ->and(Subscription::count())->toBe(2);
});

test('upgrade resets days left to the selected plan duration days', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create([
        'price' => '12000.00',
        'duration_days' => 365,
        'duration_months' => 12,
    ]);
    $sixMonthPlan = Plan::factory()->active()->create([
        'price' => '6500.00',
        'duration_days' => 180,
        'duration_months' => 6,
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2027-06-01',
        'price_paid' => '12000.00',
    ]);

    $response = $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $sixMonthPlan->id,
        'payment' => [
            'amount' => '0.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.start_date', '2026-06-10')
        // 6 calendar months from 2026-06-10 via Plan::endDateFrom / addMonthsNoOverflow
        ->assertJsonPath('data.end_date', '2026-12-10')
        ->assertJsonPath('data.price_paid', '6500.00')
        ->assertJsonPath('data.paid_total', '6500.00');

    expect((int) $response->json('data.days_left'))->toBeGreaterThan(170);
});

test('upgrade does not give credit for unpaid old subscription balance', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $yearlyPlan = Plan::factory()->active()->create([
        'price' => '12000.00',
        'duration_days' => 365,
    ]);
    $monthlyPlan = Plan::factory()->active()->create([
        'price' => '800.00',
        'duration_days' => 30,
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $yearlyPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2027-06-01',
        'price_paid' => '12000.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $monthlyPlan->id,
        'payment' => [
            'amount' => '800.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '800.00')
        ->assertJsonPath('data.paid_total', '800.00')
        ->assertJsonPath('data.balance', '0.00');
});

test('upgrade stops the old subscription and tracks the link', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $response = $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '500.00',
            'method' => 'cash',
        ],
    ])->assertStatus(201);

    $newId = $response->json('data.id');
    $newSubscription = Subscription::findOrFail($newId);

    expect($newSubscription->upgraded_from_subscription_id)->toBe($subscription->id);
});

test('upgrade with full credit coverage allows zero payment', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '1000.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '1000.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '1000.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-01 10:00:00',
    ]);

    // Full difference credit of 1000 covers VIP price of 600
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '0.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '600.00')
        ->assertJsonPath('data.paid_total', '600.00')
        ->assertJsonPath('data.balance', '0.00');
});

test('admin can override amount due on upgrade', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30, 'category' => 'gym_access']);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30, 'category' => 'gym_access']);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-01 10:00:00',
    ]);

    // Staff decides difference is 200 instead of default 300
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'amount_due' => '200.00',
        'payment' => [
            'amount' => '200.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '600.00')
        ->assertJsonPath('data.paid_total', '500.00');
});

test('upgrade rejects same plan and suggests renew', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $plan->id,
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.plan_id.0', 'Use the renew endpoint to extend the same plan.');
});

test('upgrade rejects inactive subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->expired()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '600.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.subscription.0', 'Only active subscriptions can be upgraded.');
});

test('upgrade rejects unsellable plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->inactive()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '600.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.plan_id.0', 'The selected plan is not currently sellable.');
});

test('cashier without upgrade permission cannot upgrade', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '600.00',
            'method' => 'cash',
        ],
    ])->assertStatus(403);
});

test('upgrade assigns the coach picked for the new studio plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $coach = Employee::factory()->create(['role' => 'coach']);
    $oldPlan = Plan::factory()->active()->create(['price' => '70.00']);
    $studioPlan = Plan::factory()->active()->create([
        'price' => '350.00',
        'type' => 'fitness_studio',
        'category' => 'calisthenics',
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $oldPlan->id,
        'price_paid' => '70.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $studioPlan->id,
        'coach_id' => $coach->id,
        'amount_due' => '280.00',
        'payment' => ['amount' => '280.00', 'method' => 'cash'],
    ])->assertStatus(201);

    $upgraded = Subscription::query()->where('upgraded_from_subscription_id', $subscription->id)->firstOrFail();

    expect($upgraded->coach_id)->toBe($coach->id);
});

test('upgrade keeps the existing coach when the plan change does not name one', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $coach = Employee::factory()->create(['role' => 'coach']);
    $oldPlan = Plan::factory()->active()->create(['price' => '70.00']);
    $newPlan = Plan::factory()->active()->create(['price' => '350.00']);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $oldPlan->id,
        'coach_id' => $coach->id,
        'price_paid' => '70.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $newPlan->id,
        'amount_due' => '280.00',
        'payment' => ['amount' => '280.00', 'method' => 'cash'],
    ])->assertStatus(201);

    $upgraded = Subscription::query()->where('upgraded_from_subscription_id', $subscription->id)->firstOrFail();

    expect($upgraded->coach_id)->toBe($coach->id);
});

test('upgrade keeps the extra services selected during a plan change', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $coach = Employee::factory()->create(['role' => 'coach']);
    $oldPlan = Plan::factory()->active()->create(['price' => '70.00']);
    $newPlan = Plan::factory()->active()->create(['price' => '350.00']);
    $extraPlan = Plan::factory()->active()->create(['price' => '500.00', 'category' => 'personal_training']);
    App\Models\EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id, 'plan_id' => $extraPlan->id,
        'calculation_type' => 'percentage', 'value' => '10.0000', 'is_active' => true,
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id, 'plan_id' => $oldPlan->id, 'price_paid' => '70.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $newPlan->id,
        'amount_due' => '280.00',
        'payment' => ['amount' => '280.00', 'method' => 'cash'],
        'addons' => [[
            'plan_id' => $extraPlan->id,
            'coach_id' => $coach->id,
            'discount' => '0',
            'payment' => ['amount' => '500.00', 'method' => 'cash'],
        ]],
    ])->assertStatus(201);

    $upgraded = Subscription::query()->where('upgraded_from_subscription_id', $subscription->id)->firstOrFail();

    expect($upgraded->addons()->count())->toBe(1);
});
