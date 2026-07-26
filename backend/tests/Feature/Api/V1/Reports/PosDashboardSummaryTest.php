<?php

use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Support\FoundationPermissions;
use Carbon\Carbon;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can view pos dashboard summary', function (): void {
    Carbon::setTestNow('2026-06-29 10:30:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $product = Product::factory()->create(['name' => 'Protein Shake', 'category' => 'supplements', 'stock_quantity' => 2, 'low_stock_threshold' => 5]);
    $seller = User::factory()->create(['name' => 'Cashier One']);
    $sale = Sale::factory()->create([
        'sold_by_user_id' => $seller->id,
        'total' => '150.00',
        'payment_method' => 'cash',
        'status' => 'completed',
        'created_at' => Carbon::now(),
    ]);
    SaleItem::factory()->create([
        'sale_id' => $sale->id,
        'product_id' => $product->id,
        'quantity' => 3,
        'total' => '150.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Sale::class,
        'payable_id' => $sale->id,
        'amount' => '150.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => Carbon::now(),
    ]);

    $this->getJson('/api/v1/reports/pos-summary')
        ->assertOk()
        ->assertJsonPath('data.totals.sales', '150.00')
        ->assertJsonPath('data.totals.orders', 1)
        ->assertJsonFragment(['name' => 'Protein Shake'])
        ->assertJsonStructure([
            'data' => [
                'totals' => ['sales', 'orders', 'member_buyers', 'average_sale', 'low_stock_products', 'availability_rate'],
                'sales_chart',
                'hourly_activity',
                'payment_methods',
                'top_products' => ['share_of_sales', 'categories', 'products'],
                'inventory',
                'stock_alerts',
                'recent_orders',
            ],
        ]);
});

test('pos dashboard summary filters by period and payment method', function (): void {
    Carbon::setTestNow('2026-06-29 10:30:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $product = Product::factory()->create(['name' => 'Gloves', 'category' => 'gear']);

    $bankSale = Sale::factory()->create([
        'total' => '200.00',
        'payment_method' => 'bank_transfer',
        'status' => 'completed',
        'created_at' => Carbon::parse('2026-02-10 12:00:00'),
    ]);
    SaleItem::factory()->create([
        'sale_id' => $bankSale->id,
        'product_id' => $product->id,
        'quantity' => 1,
        'total' => '200.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Sale::class,
        'payable_id' => $bankSale->id,
        'amount' => '200.00',
        'method' => 'bank_transfer',
        'status' => 'paid',
        'paid_at' => Carbon::parse('2026-02-10 12:00:00'),
    ]);

    $cashSale = Sale::factory()->create([
        'total' => '500.00',
        'payment_method' => 'cash',
        'status' => 'completed',
        'created_at' => Carbon::parse('2026-02-11 12:00:00'),
    ]);
    Payment::factory()->create([
        'payable_type' => Sale::class,
        'payable_id' => $cashSale->id,
        'amount' => '500.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => Carbon::parse('2026-02-11 12:00:00'),
    ]);

    Sale::factory()->create([
        'total' => '300.00',
        'payment_method' => 'bank_transfer',
        'status' => 'completed',
        'created_at' => Carbon::parse('2025-12-31 12:00:00'),
    ]);

    $this->getJson('/api/v1/reports/pos-summary?period=year-to-date&payment_method=bank_transfer')
        ->assertOk()
        ->assertJsonPath('data.totals.sales', '200.00')
        ->assertJsonPath('data.totals.orders', 1)
        ->assertJsonPath('data.payment_methods.0.amount', '0.00')
        ->assertJsonPath('data.payment_methods.2.amount', '200.00')
        ->assertJsonPath('data.recent_orders.0.payment_method', 'bank_transfer')
        ->assertJsonFragment(['name' => 'Gloves']);
});

test('users without reports permission cannot view pos dashboard summary', function (): void {
    // Captain/Cashier now hold reports.view so they can open the Finance shift
    // desk (see RoleMatrixSeeder + PosAccessSeeder/HrFinanceAccessSeeder), so a
    // roleless user is the honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can('reports.view'))->toBeFalse();

    $this->getJson('/api/v1/reports/pos-summary')
        ->assertForbidden();
});
