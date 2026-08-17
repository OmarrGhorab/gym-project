<?php

use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
});

function billingStatusFor(int $memberId): string
{
    return test()->getJson("/api/v1/members/{$memberId}")
        ->assertStatus(200)
        ->json('data.billing_status');
}

test('a membership given away at a full discount reads as paid, not pending', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    test()->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'discount' => '1000.00',
        'payment' => ['amount' => '0', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '0.00')
        ->assertJsonPath('data.balance', '0.00');

    // Nothing changed hands, so there is deliberately no payment row to find.
    expect(Payment::count())->toBe(0);

    // The regression: judging by the missing payment row reported the member as
    // owing money they were never charged.
    expect(billingStatusFor($member->id))->toBe('paid');
});

test('a member who still owes the price stays pending', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    test()->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'payment' => ['amount' => '0', 'method' => 'cash'],
    ])->assertStatus(201);

    expect(billingStatusFor($member->id))->toBe('pending');
});

test('a partial discount that leaves a balance still reads as pending', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    test()->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'discount' => '400.00',
        'payment' => ['amount' => '0', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '600.00');

    expect(billingStatusFor($member->id))->toBe('pending');
});

test('a free membership carrying an unpaid add-on still shows money owing', function (): void {
    $member = Member::factory()->active()->create();
    $basePlan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'price' => '1000.00',
        'duration_days' => 30,
    ]);
    $servicePlan = Plan::factory()->active()->create([
        'category' => 'nutrition',
        'price' => '300.00',
        'duration_days' => 30,
    ]);
    $coach = Employee::factory()->create(['role' => 'coach']);

    // A coach can only be sold against a service they are assigned to.
    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $servicePlan->id,
        'calculation_type' => 'percentage',
        'value' => '20.0000',
        'is_active' => true,
    ]);

    test()->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
        'start_date' => now()->toDateString(),
        'discount' => '1000.00',
        'payment' => ['amount' => '0', 'method' => 'cash'],
        'addons' => [
            [
                'plan_id' => $servicePlan->id,
                'coach_id' => $coach->id,
                'discount' => '0.00',
                'payment' => ['amount' => '0', 'method' => 'cash'],
            ],
        ],
    ])->assertStatus(201);

    // The base plan is settled but the add-on is not, so the member owes money.
    expect(billingStatusFor($member->id))->toBe('pending');
});

test('an overdue balance is still reported as overdue', function (): void {
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create(['price_paid' => '500.00']);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '500.00',
        'paid_at' => null,
        'status' => 'due',
        'due_date' => now()->subDay()->toDateString(),
    ]);

    expect(billingStatusFor($member->id))->toBe('overdue');
});

test('a member with no subscription at all is still a trial', function (): void {
    $member = Member::factory()->active()->create();

    expect(billingStatusFor($member->id))->toBe('trial');
});
