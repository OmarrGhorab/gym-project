<?php

use App\Models\Expense;
use App\Models\Member;
use App\Models\MemberBooking;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
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
    $subscription = Subscription::factory()->for($member)->for(Plan::factory())->create();

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

    $this->getJson('/api/v1/reports/overview?from=2026-07-26&to=2026-07-26')
        ->assertOk()
        ->assertJsonPath('data.totals.expenses', '75.00')
        ->assertJsonPath('data.totals.pos_sales', '120.00')
        ->assertJsonPath('data.totals.bookings', 1)
        ->assertJsonPath('data.totals.memberships', 1)
        ->assertJsonPath('data.totals.membership_revenue', '300.00')
        ->assertJsonPath('data.totals.session_visits', 1);
});
