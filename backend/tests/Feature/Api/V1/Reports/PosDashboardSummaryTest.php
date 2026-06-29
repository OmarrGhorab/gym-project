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

test('users without reports permission cannot view pos dashboard summary', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/pos-summary')
        ->assertForbidden();
});
