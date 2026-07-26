<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\PosPermissions;
use Carbon\Carbon;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
    Cache::flush();
});

test('authenticated user with reports.view permission can view dashboard summary', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $response = $this->getJson('/api/v1/dashboard/summary')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'active_subscriptions',
                'frozen_subscriptions',
                'revenue_mtd',
                'subscription_revenue_mtd',
                'subscription_revenue_live',
                'outstanding_dues_total',
                'outstanding_dues_count',
                'revenue_growth_rate',
                'new_members_this_month',
                'new_members_previous_month',
                'new_members_growth_rate',
                'expiring_soon',
                'sales_today' => ['count', 'revenue'],
                'top_products',
                'captain_leaderboard',
            ],
            'message',
        ]);
});

test('dashboard summary returns accurate numbers and is cached and invalidated correctly', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Seed data
    $plan = Plan::factory()->active()->create();
    $member = Member::factory()->active()->create();
    $employeeUser = User::factory()->create(['name' => 'Captain America']);
    $employee = Employee::factory()->create([
        'user_id' => $employeeUser->id,
        'role' => 'captain',
        'status' => 'active',
    ]);

    // Active subscription
    Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'active',
        'sold_by_user_id' => $employeeUser->id,
        'end_date' => Carbon::today()->addDays(5)->toDateString(), // expiring soon
    ]);

    // Payment MTD
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => 1,
        'amount' => '450.00',
        'status' => 'paid',
        'paid_at' => Carbon::now()->startOfMonth()->addDays(1),
    ]);

    // Sale today
    $sale = Sale::factory()->create([
        'member_id' => $member->id,
        'sold_by_user_id' => $employeeUser->id,
        'total' => '80.00',
        'status' => 'completed',
        'created_at' => Carbon::now(),
    ]);

    // Commission this month
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'source_type' => Sale::class,
        'source_id' => $sale->id,
        'amount' => '60.00',
        'month' => Carbon::now()->format('Y-m'),
        'created_at' => Carbon::now(),
    ]);

    // Get first response
    $response1 = $this->getJson('/api/v1/dashboard/summary')
        ->assertStatus(200);

    expect($response1->json('data.active_subscriptions'))->toBe(1);
    expect($response1->json('data.revenue_mtd'))->toBe('450.00');
    expect($response1->json('data.revenue_growth_rate'))->toBe('100.00');
    expect($response1->json('data.new_members_this_month'))->toBe(1);
    expect($response1->json('data.new_members_previous_month'))->toBe(0);
    expect($response1->json('data.new_members_growth_rate'))->toBe('100.00');
    expect($response1->json('data.expiring_soon'))->toBe(1);
    expect($response1->json('data.sales_today.count'))->toBe(1);
    expect($response1->json('data.sales_today.revenue'))->toBe('80.00');
    expect($response1->json('data.captain_leaderboard.0.name'))->toBe('Captain America');
    // The leaderboard aggregates every commission the employee earned this month:
    // the 60.00 seeded above plus the 3.00 `subscription_sale` commission that
    // CalculateCommission auto-creates (1% of the 300.00 subscription sold by this user).
    expect($response1->json('data.captain_leaderboard.0.commissions_total'))->toBe('63.00');

    // Create another sale today bypassing events - output should be cached and NOT change
    Sale::withoutEvents(function () use ($employeeUser) {
        Sale::factory()->create([
            'sold_by_user_id' => $employeeUser->id,
            'total' => '120.00',
            'status' => 'completed',
            'created_at' => Carbon::now(),
        ]);
    });

    $response2 = $this->getJson('/api/v1/dashboard/summary')
        ->assertStatus(200);

    // Verify it is served from cache (sales today count is still 1)
    expect($response2->json('data.sales_today.count'))->toBe(1);

    // Fire cache invalidation (clear cache manually to simulate invalidation, or check if observer triggers it)
    Cache::forget('dashboard:summary:v3');

    $response3 = $this->getJson('/api/v1/dashboard/summary')
        ->assertStatus(200);

    // Verify cache is updated (sales today count is now 2)
    expect($response3->json('data.sales_today.count'))->toBe(2);
});

test('unauthenticated users cannot view dashboard summary', function (): void {
    $this->getJson('/api/v1/dashboard/summary')
        ->assertStatus(401);
});

test('users without reports.view permission cannot view dashboard summary', function (): void {
    // Captain is no longer a valid stand-in for "lacks reports.view": HrFinanceAccessSeeder
    // deliberately grants Captain reports.view so floor staff can open the shift desk.
    // A plain authenticated user with no role still holds no permission at all.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can(PosPermissions::PERM_REPORTS_VIEW))->toBeFalse();

    $this->getJson('/api/v1/dashboard/summary')
        ->assertStatus(403);
});
