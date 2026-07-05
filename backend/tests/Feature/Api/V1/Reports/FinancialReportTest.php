<?php

use App\Models\Expense;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('authenticated user with reports.view permission can view financial report', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $response = $this->getJson('/api/v1/reports/financial?from=2026-06-01&to=2026-06-05&group_by=day')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['period', 'revenue', 'expenses', 'net_profit'],
            ],
            'meta' => [
                'from',
                'to',
                'group_by',
                'totals' => ['revenue', 'expenses', 'net_profit'],
            ],
            'message',
        ]);
});

test('unauthenticated users cannot view financial report', function (): void {
    $this->getJson('/api/v1/reports/financial?from=2026-06-01&to=2026-06-05&group_by=day')
        ->assertStatus(401);
});

test('users without reports.view permission cannot view financial report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/financial?from=2026-06-01&to=2026-06-05&group_by=day')
        ->assertStatus(403);
});

test('financial report defaults to the current month when no range is supplied', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    // Per the contract, omitting the range defaults to the current month (day grouping).
    $this->getJson('/api/v1/reports/financial')
        ->assertStatus(200)
        ->assertJsonPath('meta.from', now()->startOfMonth()->toDateString())
        ->assertJsonPath('meta.to', now()->toDateString())
        ->assertJsonPath('meta.group_by', 'day');
});

test('financial report rejects invalid parameters', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->getJson('/api/v1/reports/financial?from=not-a-date&to=2026-06-01&group_by=invalid')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['from', 'group_by']]]);
});

test('finance dashboard summary returns real gym finance aggregates', function (): void {
    Carbon::setTestNow('2026-06-15 12:00:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $subscription = Subscription::factory()->create([
        'price_paid' => '500.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => Carbon::now(),
    ]);
    $sale = Sale::factory()->create([
        'total' => '200.00',
        'status' => 'completed',
        'created_at' => Carbon::now(),
    ]);
    Payment::factory()->create([
        'payable_type' => Sale::class,
        'payable_id' => $sale->id,
        'amount' => '200.00',
        'method' => 'card',
        'status' => 'paid',
        'paid_at' => Carbon::now(),
    ]);
    Expense::factory()->create([
        'amount' => '120.00',
        'date' => Carbon::now()->toDateString(),
        'created_by' => $accountant->id,
    ]);

    $this->getJson('/api/v1/reports/finance-summary')
        ->assertOk()
        ->assertJsonPath('data.totals.revenue_mtd', '500.00')
        ->assertJsonPath('data.totals.expenses_mtd', '120.00')
        ->assertJsonPath('data.revenue_sources.0.amount', '300.00')
        ->assertJsonPath('data.revenue_sources.1.amount', '200.00')
        ->assertJsonPath('data.revenue_sources.2.amount', '0.00')
        ->assertJsonStructure([
            'data' => [
                'totals' => [
                    'revenue_mtd',
                    'expenses_mtd',
                    'pending_payroll',
                    'outstanding_dues',
                    'net_profit_mtd',
                    'profit_margin',
                ],
                'revenue_sources',
                'payment_methods',
                'chart',
                'upcoming' => ['dues', 'pending_payroll', 'recent_expenses'],
            ],
        ]);
});
