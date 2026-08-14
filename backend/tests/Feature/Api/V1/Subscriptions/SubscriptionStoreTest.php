<?php

use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('admin can create a subscription and receives 201', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $startDate = now()->toDateString();
    $endDate = now()->addDays(30)->toDateString();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'discount' => '50.00',
        'payment' => [
            'amount' => '250.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('data.member.id', $member->id)
            ->where('data.plan.id', $plan->id)
            ->where('data.status', 'active')
            ->where('data.start_date', $startDate)
            ->where('data.end_date', $endDate)
            ->where('data.sold_by.id', $user->id)
            ->has('message')
            ->has('meta')
        );

    expect(Subscription::count())->toBe(1);
});

test('admin can create a base subscription with a coached service add-on', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basePlan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'price' => '480.00',
        'duration_days' => 30,
    ]);
    $servicePlan = Plan::factory()->active()->create([
        'category' => 'nutrition',
        'price' => '600.00',
        'duration_days' => 30,
    ]);
    $coach = Employee::factory()->create(['role' => 'coach']);

    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $servicePlan->id,
        'calculation_type' => 'percentage',
        'value' => '20.0000',
        'is_active' => true,
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
        'start_date' => '2026-07-07',
        'payment' => [
            'amount' => '480.00',
            'method' => 'cash',
        ],
        'addons' => [
            [
                'plan_id' => $servicePlan->id,
                'coach_id' => $coach->id,
                'discount' => '0.00',
                'payment' => [
                    'amount' => '600.00',
                    'method' => 'card',
                ],
            ],
        ],
    ])->assertStatus(201);

    expect(Subscription::count())->toBe(1)
        ->and(SubscriptionAddon::count())->toBe(1)
        ->and(SubscriptionAddon::first()?->coach_id)->toBe($coach->id)
        ->and(SubscriptionAddon::first()?->price_paid)->toBe('600.00');

    $this->getJson("/api/v1/members?filter[search]={$member->id}")
        ->assertOk()
        ->assertJsonPath('data.0.total_paid', '1080.00')
        ->assertJsonPath('data.0.latest_subscription.price_paid', '480.00')
        ->assertJsonPath('data.0.latest_subscription.package_paid_total', '1080.00')
        ->assertJsonPath('data.0.latest_subscription.package_price_paid', '1080.00');
});

test('buying a new main membership keeps an already-paid active extra service without charging it again', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $oldMainPlan = Plan::factory()->active()->create(['category' => 'gym_access']);
    $newMainPlan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'price' => '700.00',
        'duration_days' => 30,
    ]);
    $extraPlan = Plan::factory()->active()->create(['category' => 'nutrition']);
    $oldSubscription = Subscription::factory()->stopped()->create([
        'member_id' => $member->id,
        'plan_id' => $oldMainPlan->id,
    ]);
    $extra = SubscriptionAddon::query()->create([
        'subscription_id' => $oldSubscription->id,
        'member_id' => $member->id,
        'plan_id' => $extraPlan->id,
        'start_date' => now()->subDays(5)->toDateString(),
        'end_date' => now()->addDays(20)->toDateString(),
        'status' => 'active',
        'price_paid' => '600.00',
        'sessions_total' => 12,
        'sessions_remaining' => 9,
    ]);

    $response = $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $newMainPlan->id,
        'start_date' => now()->toDateString(),
        'payment' => [
            'amount' => '700.00',
            'method' => 'cash',
        ],
    ])->assertCreated();

    $newSubscriptionId = $response->json('data.id');
    $extra->refresh();

    expect($extra->subscription_id)->toBe($newSubscriptionId)
        ->and($extra->price_paid)->toBe('600.00')
        ->and($extra->sessions_remaining)->toBe(9)
        ->and($response->json('data.addons.0.id'))->toBe($extra->id)
        ->and(Payment::query()->where('payable_type', SubscriptionAddon::class)->count())->toBe(0)
        ->and(
            bcadd(
                (string) Payment::query()->where('payable_type', Subscription::class)->where('payable_id', $newSubscriptionId)->sum('amount'),
                '0.00',
                2,
            ),
        )->toBe('700.00');
});

test('a refunded or stopped extra service is not carried to a new main membership', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $oldSubscription = Subscription::factory()->stopped()->create(['member_id' => $member->id]);
    $stoppedExtra = SubscriptionAddon::query()->create([
        'subscription_id' => $oldSubscription->id,
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->active()->create(['category' => 'nutrition'])->id,
        'start_date' => now()->subDays(5)->toDateString(),
        'end_date' => now()->addDays(20)->toDateString(),
        'status' => 'stopped',
        'price_paid' => '600.00',
    ]);
    $newPlan = Plan::factory()->active()->create(['category' => 'gym_access', 'price' => '700.00']);

    $newSubscriptionId = $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $newPlan->id,
        'start_date' => now()->toDateString(),
        'payment' => ['amount' => '700.00', 'method' => 'cash'],
    ])->assertCreated()->json('data.id');

    expect($stoppedExtra->fresh()->subscription_id)->toBe($oldSubscription->id)
        ->and(Subscription::find($newSubscriptionId)?->addons()->count())->toBe(0);
});

test('calendar month plans charge one cycle from same day to next month', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'duration_days' => 30,
        'duration_months' => 1,
        'price' => '650.00',
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-07-07',
        'end_date' => '2026-08-07',
        'payment' => [
            'amount' => '650.00',
            'method' => 'cash',
        ],
    ])
        ->assertCreated()
        ->assertJsonPath('data.price_paid', '650.00')
        ->assertJsonPath('data.package_price_paid', '650.00')
        ->assertJsonPath('data.package_paid_total', '650.00')
        ->assertJsonPath('data.package_balance', '0.00')
        ->assertJsonPath('data.billing_status', 'paid');
});

test('subscription create rejects gym access plans as add-ons', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basePlan = Plan::factory()->active()->create(['category' => 'gym_access']);
    $addonPlan = Plan::factory()->active()->create(['category' => 'gym_access']);
    $coach = Employee::factory()->create(['role' => 'coach']);

    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $addonPlan->id,
        'calculation_type' => 'fixed',
        'value' => '100.0000',
        'is_active' => true,
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
        'start_date' => '2026-07-07',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
        'addons' => [
            [
                'plan_id' => $addonPlan->id,
                'coach_id' => $coach->id,
                'payment' => [
                    'amount' => '100.00',
                    'method' => 'cash',
                ],
            ],
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('subscription create rejects add-on coaches not assigned to the service plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basePlan = Plan::factory()->active()->create(['category' => 'gym_access']);
    $servicePlan = Plan::factory()->active()->create(['category' => 'recovery']);
    $coach = Employee::factory()->create(['role' => 'coach']);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
        'start_date' => '2026-07-07',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
        'addons' => [
            [
                'plan_id' => $servicePlan->id,
                'coach_id' => $coach->id,
                'payment' => [
                    'amount' => '100.00',
                    'method' => 'cash',
                ],
            ],
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('admin can list subscriptions', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    Subscription::factory()->count(2)->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.0.id')
            ->has('meta.current_page')
            ->has('message')
        );
});

test('subscription list includes payment balance and renewal health fields', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '450.00',
        'end_date' => now()->addDays(5)->toDateString(),
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '150.00',
        'status' => 'partial',
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJsonPath('data.0.paid_total', '150.00')
        ->assertJsonPath('data.0.balance', '300.00')
        ->assertJsonPath('data.0.billing_status', 'pending')
        ->assertJsonPath('data.0.days_left', 5)
        ->assertJsonPath('data.0.renewal_health', 'needs_action')
        ->assertJsonPath('data.0.renewal_health_reason', 'has_balance');
});

test('subscription renewal health distinguishes session and period timing mismatches', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $sessionsFinishedMember = Member::factory()->active()->create();
    Subscription::factory()->for($sessionsFinishedMember)->active()->create([
        'start_date' => now()->subDay()->toDateString(),
        'end_date' => now()->addDays(29)->toDateString(),
        'sessions_total' => 10,
        'sessions_remaining' => 0,
    ]);

    $this->getJson("/api/v1/subscriptions?filter[member_id]={$sessionsFinishedMember->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.0.days_left', 29)
        ->assertJsonPath('data.0.renewal_health', 'sessions_exhausted')
        ->assertJsonPath('data.0.renewal_health_reason', 'sessions_exhausted');

    $periodEndedMember = Member::factory()->active()->create();
    Subscription::factory()->for($periodEndedMember)->active()->create([
        'start_date' => now()->subDays(31)->toDateString(),
        'end_date' => now()->subDay()->toDateString(),
        'sessions_total' => 10,
        'sessions_remaining' => 3,
    ]);

    $this->getJson("/api/v1/subscriptions?filter[member_id]={$periodEndedMember->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.0.status', 'expired')
        ->assertJsonPath('data.0.renewal_health', 'period_ended_sessions_left')
        ->assertJsonPath('data.0.renewal_health_reason', 'period_ended_sessions_left');
});

test('subscription list marks active subscriptions past end date as expired', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => now()->subDay()->toDateString(),
        'price_paid' => '450.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '450.00',
        'status' => 'paid',
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJsonPath('data.0.status', 'expired')
        ->assertJsonPath('data.0.renewal_health', 'needs_action')
        ->assertJsonPath('data.0.renewal_health_reason', 'expired');
});

test('subscription list keeps active status during plan access grace days', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'access_grace_days' => 3,
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => now()->subDay()->toDateString(),
        'price_paid' => '450.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '450.00',
        'status' => 'paid',
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJsonPath('data.0.status', 'active')
        ->assertJsonPath('data.0.renewal_health', 'renew_soon')
        ->assertJsonPath('data.0.renewal_health_reason', 'ends_in');
});

test('admin can view subscription summary', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $activeSubscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => now()->addDays(3)->toDateString(),
        'price_paid' => '100.00',
    ]);
    $addonPlan = Plan::factory()->active()->create(['category' => 'nutrition']);
    $addon = SubscriptionAddon::create([
        'subscription_id' => $activeSubscription->id,
        'member_id' => $member->id,
        'plan_id' => $addonPlan->id,
        'start_date' => $activeSubscription->start_date,
        'end_date' => $activeSubscription->end_date,
        'status' => 'active',
        'price_paid' => '75.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $activeSubscription->id,
        'amount' => '100.00',
        'status' => 'paid',
        'paid_at' => now(),
    ]);
    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '75.00',
        'status' => 'paid',
        'paid_at' => now(),
    ]);

    $stopped = Subscription::factory()->stopped()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '50.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $stopped->id,
        'amount' => '50.00',
        'status' => 'paid',
        'paid_at' => now(),
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $stopped->id,
        'amount' => '-50.00',
        'status' => 'refunded',
        'paid_at' => now(),
    ]);

    Subscription::factory()->expired()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '200.00',
    ]);

    // Revenue = net collected on active/frozen only (100 + 75). Stopped/expired ignored.
    $this->getJson('/api/v1/subscriptions/summary')
        ->assertStatus(200)
        ->assertJsonPath('data.total', 3)
        ->assertJsonPath('data.active', 1)
        ->assertJsonPath('data.expired', 1)
        ->assertJsonPath('data.stopped', 1)
        ->assertJsonPath('data.expiring_soon', 1)
        ->assertJsonPath('data.revenue', '175.00')
        ->assertJsonPath('data.outstanding_dues_count', 0);
});

test('subscription summary can filter by status', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $active = Subscription::factory()->active()->create(['price_paid' => '100.00']);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $active->id,
        'amount' => '100.00',
        'status' => 'paid',
        'paid_at' => now(),
    ]);
    $expired = Subscription::factory()->expired()->create(['price_paid' => '200.00']);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $expired->id,
        'amount' => '200.00',
        'status' => 'paid',
        'paid_at' => now(),
    ]);

    // Filter status=expired has no active/frozen rows → net tracked revenue is 0.
    $this->getJson('/api/v1/subscriptions/summary?filter[status]=expired')
        ->assertStatus(200)
        ->assertJsonPath('data.total', 1)
        ->assertJsonPath('data.active', 0)
        ->assertJsonPath('data.expired', 1)
        ->assertJsonPath('data.revenue', '0.00');
});

test('admin can show a subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'sold_by_user_id' => $user->id,
    ]);

    $this->getJson("/api/v1/subscriptions/{$subscription->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.id', $subscription->id);
});

test('subscription create rejects inactive member with 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->inactive()->create();
    $plan = Plan::factory()->active()->create();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('subscription create rejects unsellable plan with 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->inactive()->create();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('unauthenticated subscription requests receive 401', function (): void {
    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without subscriptions create permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('a partial payment leaves the remainder as a balance due', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'payment' => [
            'amount' => '500.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '1000.00')
        ->assertJsonPath('data.paid_total', '500.00')
        ->assertJsonPath('data.balance', '500.00')
        ->assertJsonPath('data.billing_status', 'pending');

    $payment = Payment::query()->where('payable_id', Subscription::query()->value('id'))->firstOrFail();

    expect($payment->status)->toBe('partial')
        ->and($payment->due_date)->not->toBeNull();
});

test('a subscription can be taken with nothing paid up front and the whole price stays due', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'payment' => [
            'amount' => '0',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.balance', '1000.00')
        ->assertJsonPath('data.billing_status', 'pending');

    // Nothing was handed over, so there is no payment row to report as revenue.
    expect(Payment::count())->toBe(0);
});

test('the balance from a partial payment can be settled later', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'payment' => ['amount' => '500.00', 'method' => 'cash'],
    ])->assertStatus(201);

    $subscription = Subscription::query()->firstOrFail();

    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '500.00',
        'method' => 'cash',
    ])->assertStatus(201);

    $this->getJson("/api/v1/subscriptions/{$subscription->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.balance', '0.00')
        ->assertJsonPath('data.billing_status', 'paid');
});

test('an advance sale can start on a future date', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    $startDate = now()->addWeek()->toDateString();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => $startDate,
        'payment' => ['amount' => '1000.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.start_date', $startDate)
        ->assertJsonPath('data.end_date', now()->addWeek()->addDays(30)->toDateString());
});

test('an advance sale reads as scheduled until its start date arrives', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '1000.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->addDays(4)->toDateString(),
        'payment' => ['amount' => '1000.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonPath('data.starts_in_days', 4);

    // The row itself stays active — nothing has to run for it to start.
    expect(Subscription::query()->value('status'))->toBe('active');
});

test('a scheduled subscription reads as active once its start date arrives', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '1000.00', 'duration_days' => 30]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->addDays(4)->toDateString(),
        'payment' => ['amount' => '1000.00', 'method' => 'cash'],
    ])->assertStatus(201);

    $subscription = Subscription::query()->firstOrFail();

    $this->travel(4)->days();

    $this->getJson("/api/v1/subscriptions/{$subscription->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.starts_in_days', null);

    $this->travelBack();
});

test('a subscription starting today is active, not scheduled', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '1000.00', 'duration_days' => 30]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'payment' => ['amount' => '1000.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.starts_in_days', null);
});

test('a member cannot check in before an advance sale starts', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '1000.00', 'duration_days' => 30]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->addDays(4)->toDateString(),
        'payment' => ['amount' => '1000.00', 'method' => 'cash'],
    ])->assertStatus(201);

    $this->postJson('/api/v1/member-visits', ['member_id' => $member->id])
        ->assertStatus(422);
});

test('the member payload reports an advance sale as scheduled, not active', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '1000.00', 'duration_days' => 30]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->addDays(4)->toDateString(),
        'payment' => ['amount' => '1000.00', 'method' => 'cash'],
    ])->assertStatus(201);

    // The members screen is where staff sell the membership, so it is the first
    // place they look afterwards — it has to agree with the subscription itself.
    $this->getJson("/api/v1/members/{$member->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.membership_status', 'scheduled')
        ->assertJsonPath('data.latest_subscription.status', 'scheduled');
});

test('the member payload reports a started subscription as active', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '1000.00', 'duration_days' => 30]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => now()->toDateString(),
        'payment' => ['amount' => '1000.00', 'method' => 'cash'],
    ])->assertStatus(201);

    $this->getJson("/api/v1/members/{$member->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.membership_status', 'active')
        ->assertJsonPath('data.latest_subscription.status', 'active');
});
