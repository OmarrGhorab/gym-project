<?php

use App\Actions\Subscriptions\RenewSubscription;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('renew subscription starts the day after an unexpired subscription ends', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $source = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($renewed->id)->not->toBe($source->id)
        ->and($renewed->start_date->toDateString())->toBe('2026-07-01')
        ->and($renewed->end_date->toDateString())->toBe('2026-07-31');
});

test('renew subscription keeps the coach on the same plan', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $coach = Employee::factory()->create(['role' => 'coach']);
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $source = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($renewed->coach_id)->toBe($coach->id);
});

test('renew subscription can re-buy a closed extra service alongside the main plan', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $coach = Employee::factory()->create(['role' => 'coach']);
    $plan = Plan::factory()->active()->create(['price' => '800.00', 'duration_days' => 30]);
    $extraPlan = Plan::factory()->active()->create([
        'price' => '2500.00',
        'duration_days' => 30,
        'category' => 'personal_training',
    ]);
    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $extraPlan->id,
        'calculation_type' => 'percentage',
        'value' => '20.0000',
        'is_active' => true,
    ]);

    $source = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'stopped',
        'start_date' => '2026-05-10',
        'end_date' => '2026-06-09',
        'price_paid' => '800.00',
    ]);
    SubscriptionAddon::create([
        'subscription_id' => $source->id,
        'member_id' => $member->id,
        'plan_id' => $extraPlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-05-10',
        'end_date' => '2026-06-09',
        'status' => 'stopped',
        'price_paid' => '2500.00',
        'discount' => '0.00',
        'sold_by_user_id' => $seller->id,
        'created_by' => $seller->id,
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => ['amount' => '800.00', 'method' => 'cash'],
        'addons' => [[
            'plan_id' => $extraPlan->id,
            'coach_id' => $coach->id,
            'discount' => '0.00',
            'payment' => ['amount' => '2500.00', 'method' => 'cash'],
        ]],
    ], $seller);

    $renewed->load('addons');

    expect($renewed->price_paid)->toBe('800.00')
        ->and($renewed->addons)->toHaveCount(1)
        ->and($renewed->addons->first()->price_paid)->toBe('2500.00')
        ->and($renewed->addons->first()->coach_id)->toBe($coach->id);
});

test('renew subscription without addons renews the main plan alone', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $coach = Employee::factory()->create(['role' => 'coach']);
    $plan = Plan::factory()->active()->create(['price' => '800.00', 'duration_days' => 30]);
    $extraPlan = Plan::factory()->active()->create(['price' => '2500.00', 'duration_days' => 30]);

    $source = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'stopped',
        'start_date' => '2026-05-10',
        'end_date' => '2026-06-09',
        'price_paid' => '800.00',
    ]);
    // A closed extra must NOT follow the member into the new period on its own.
    SubscriptionAddon::create([
        'subscription_id' => $source->id,
        'member_id' => $member->id,
        'plan_id' => $extraPlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-05-10',
        'end_date' => '2026-06-09',
        'status' => 'stopped',
        'price_paid' => '2500.00',
        'discount' => '0.00',
        'sold_by_user_id' => $seller->id,
        'created_by' => $seller->id,
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => ['amount' => '800.00', 'method' => 'cash'],
    ], $seller);

    expect($renewed->load('addons')->addons)->toHaveCount(0);
});

test('renew subscription does not duplicate an extra that is still running', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $coach = Employee::factory()->create(['role' => 'coach']);
    $plan = Plan::factory()->active()->create(['price' => '800.00', 'duration_days' => 30]);
    $extraPlan = Plan::factory()->active()->create([
        'price' => '2500.00',
        'duration_days' => 30,
        'category' => 'personal_training',
    ]);
    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $extraPlan->id,
        'calculation_type' => 'percentage',
        'value' => '20.0000',
        'is_active' => true,
    ]);

    $source = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'stopped',
        'start_date' => '2026-05-10',
        'end_date' => '2026-06-09',
        'price_paid' => '800.00',
    ]);
    SubscriptionAddon::create([
        'subscription_id' => $source->id,
        'member_id' => $member->id,
        'plan_id' => $extraPlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-05-10',
        'end_date' => '2026-12-31',
        'status' => 'active',
        'price_paid' => '2500.00',
        'discount' => '0.00',
        'sold_by_user_id' => $seller->id,
        'created_by' => $seller->id,
    ]);

    // Re-buying a service the member already has running must leave one line, not two.
    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => ['amount' => '800.00', 'method' => 'cash'],
        'addons' => [[
            'plan_id' => $extraPlan->id,
            'coach_id' => $coach->id,
            'payment' => ['amount' => '2500.00', 'method' => 'cash'],
        ]],
    ], $seller);

    expect($renewed->load('addons')->addons)->toHaveCount(1);
});

test('renew subscription refuses to stack a period on a frozen membership', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    // end_date still holds the pre-freeze value; it moves when the member resumes,
    // so a renewal stacked on it would swallow the protected days.
    $source = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'frozen',
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    expect(fn () => app(RenewSubscription::class)->handle($source, [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller))->toThrow(ValidationException::class)
        ->and(Subscription::count())->toBe(1);
});

test('renew subscription records no payment when a full discount covers the period', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $source = Subscription::factory()->expired()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-04-01',
        'end_date' => '2026-05-01',
        'price_paid' => '300.00',
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'discount' => '300.00',
        'payment' => [
            'amount' => '0.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($renewed->price_paid)->toBe('0.00')
        ->and($renewed->payments()->count())->toBe(0)
        ->and($renewed->end_date->toDateString())->toBe('2026-07-10');
});

test('renew subscription starts today when the source subscription is already expired', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $source = Subscription::factory()->expired()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-04-01',
        'end_date' => '2026-05-01',
        'price_paid' => '300.00',
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($renewed->start_date->toDateString())->toBe('2026-06-10')
        ->and($renewed->end_date->toDateString())->toBe('2026-07-10')
        ->and(Subscription::count())->toBe(2);
});

test('renew subscription starts today when the source was stopped with remaining calendar days', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    // Old bug: stopped kept end_date in the future, so renew stacked from end_date+1 (~60 days total).
    $source = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'stopped',
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'price_paid' => '300.00',
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($renewed->start_date->toDateString())->toBe('2026-06-10')
        ->and($renewed->end_date->toDateString())->toBe('2026-07-10')
        ->and($renewed->status)->toBe('active');
});
