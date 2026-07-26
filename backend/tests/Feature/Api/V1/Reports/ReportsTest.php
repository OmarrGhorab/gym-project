<?php

use App\Models\Member;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
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

test('products finance report returns itemized sales details for a product', function (): void {
    $user = User::factory()->create(['name' => 'Cashier']);
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->create([
        'email' => 'buyer@example.com',
        'name' => 'Buyer One',
        'phone' => '01000000000',
    ]);
    $product = Product::factory()->create(['cost' => '10.00', 'name' => 'Electrolyte Water']);
    $sale = Sale::factory()->create([
        'created_at' => '2026-06-15 12:00:00',
        'discount' => '20.00',
        'member_id' => $member->id,
        'payment_method' => 'cash',
        'sold_by_user_id' => $user->id,
        'subtotal' => '100.00',
        'total' => '80.00',
    ]);
    SaleItem::factory()->create([
        'product_id' => $product->id,
        'quantity' => 2,
        'sale_id' => $sale->id,
        'total' => '50.00',
        'unit_price' => '25.00',
    ]);

    $response = $this->getJson("/api/v1/reports/products-finance?product_id={$product->id}&from=2026-06-01&to=2026-06-30")
        ->assertOk();

    expect($response->json('data.product_sales'))->toHaveCount(1)
        ->and($response->json('data.product_sales.0'))->toMatchArray([
            'allocated_discount' => '10.00',
            'member_email' => 'buyer@example.com',
            'member_name' => 'Buyer One',
            'net_received' => '40.00',
            'net_profit' => '20.00',
            'quantity' => 2,
            'seller_name' => 'Cashier',
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
