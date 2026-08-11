<?php

use App\Models\Expense;
use App\Models\Member;
use App\Models\MemberBooking;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionRefund;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('reports overview returns daily expenses, sales, bookings, memberships and session visits', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $member = Member::factory()->create();
    $sale = Sale::factory()->for($member)->create();
    $subscription = Subscription::factory()->for($member)->for(Plan::factory())->create([
        'created_at' => '2026-07-26 08:00:00',
    ]);

    Expense::factory()->create(['amount' => '75.00', 'date' => '2026-07-26']);
    MemberBooking::query()->create([
        'member_id' => $member->id,
        'title' => 'PT session',
        'type' => 'session',
        'starts_at' => '2026-07-26 10:00:00',
        'status' => 'scheduled',
    ]);
    MemberVisit::factory()->for($member)->create(['check_in_at' => '2026-07-26 12:00:00']);
    Payment::factory()->create(['payable_type' => Sale::class, 'payable_id' => $sale->id, 'amount' => '120.00', 'paid_at' => '2026-07-26 09:00:00']);
    Payment::factory()->create(['payable_type' => Subscription::class, 'payable_id' => $subscription->id, 'amount' => '300.00', 'paid_at' => '2026-07-26 09:30:00']);
    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $subscription->plan_id,
        'start_date' => '2026-07-26',
        'end_date' => '2026-08-25',
        'status' => 'active',
        'price_paid' => '75.00',
    ]);
    Payment::factory()->create(['payable_type' => SubscriptionAddon::class, 'payable_id' => $addon->id, 'amount' => '75.00', 'paid_at' => '2026-07-26 09:35:00']);

    $this->getJson('/api/v1/reports/overview?from=2026-07-26&to=2026-07-26')
        ->assertOk()
        ->assertJsonPath('data.totals.expenses', '75.00')
        ->assertJsonPath('data.totals.pos_sales', '120.00')
        ->assertJsonPath('data.totals.bookings', 1)
        ->assertJsonPath('data.totals.memberships', 1)
        ->assertJsonPath('data.totals.membership_revenue', '375.00')
        ->assertJsonPath('data.totals.session_visits', 1);
});

test('reports overview keeps membership revenue gross and reports refunds separately', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $member = Member::factory()->create();
    $subscription = Subscription::factory()->for($member)->for(Plan::factory())->create([
        'created_at' => '2026-07-26 08:00:00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '1000.00',
        'paid_at' => '2026-07-26 09:00:00',
        'status' => 'paid',
    ]);
    // Refund day: netting this into the revenue card used to drive it negative
    // with nothing on screen explaining where the money went.
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '-1200.00',
        'paid_at' => '2026-07-26 15:00:00',
        'status' => Payment::STATUS_REFUNDED,
    ]);
    SubscriptionRefund::create([
        'subscription_id' => $subscription->id,
        'amount' => '1200.00',
        'method' => 'cash',
        'reason' => 'cancelled',
        'refunded_at' => '2026-07-26 15:00:00',
        'created_by' => $admin->id,
    ]);

    $this->getJson('/api/v1/reports/overview?from=2026-07-26&to=2026-07-26')
        ->assertOk()
        ->assertJsonPath('data.totals.membership_revenue', '1000.00')
        ->assertJsonPath('data.totals.refunds', '1200.00')
        ->assertJsonPath('data.daily.0.membership_revenue', '1000.00')
        ->assertJsonPath('data.daily.0.refunds', '1200.00');
});
