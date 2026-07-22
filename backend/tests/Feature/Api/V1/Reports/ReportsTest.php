<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('admin can access classes plans report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/classes-plans')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['active_members', 'expired_members', 'expiring_soon', 'new_subscriptions_period', 'total_revenue_period'],
                'plans_summary',
                'subscriptions',
            ],
        ]);
});

test('admin can access products finance report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/products-finance')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['total_pos_revenue', 'total_orders', 'total_units_sold', 'low_stock_products_count'],
                'products_summary',
                'transactions',
            ],
        ]);
});

test('admin can access subs shifts report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/subs-shifts')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['total_shifts_count', 'total_subscription_revenue', 'total_pos_revenue', 'total_shift_revenue', 'total_cash_discrepancy'],
                'shifts',
            ],
        ]);
});

test('admin can access income outcome report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/income-outcome')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'totals' => ['subscription_income', 'pos_income', 'other_income', 'total_income', 'expenses_outcome', 'payroll_outcome', 'refunds_outcome', 'total_outcome', 'net_profit', 'profit_margin'],
                'timeline',
            ],
        ]);
});
