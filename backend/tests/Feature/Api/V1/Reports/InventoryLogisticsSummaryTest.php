<?php

use App\Actions\PurchaseOrders\CreatePurchaseOrder;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can view inventory logistics summary', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $product = Product::factory()->create([
        'name' => 'Whey Protein',
        'stock_quantity' => 2,
        'low_stock_threshold' => 5,
        'image' => 'products/whey.jpg',
    ]);
    InventoryMovement::factory()->create([
        'product_id' => $product->id,
        'type' => 'adjust',
        'quantity' => -3,
        'reason' => 'Stock count correction',
    ]);

    app(CreatePurchaseOrder::class)->handle([
        'supplier_name' => 'Supplement Supplier',
        'expected_at' => now()->addDays(3)->toDateString(),
        'items' => [
            [
                'product_id' => $product->id,
                'quantity_ordered' => 12,
                'unit_cost' => '100.00',
            ],
        ],
    ]);

    $this->getJson('/api/v1/reports/inventory-logistics')
        ->assertOk()
        ->assertJsonPath('data.stats.products_total', 1)
        ->assertJsonPath('data.stats.low_stock_products', 1)
        ->assertJsonPath('data.purchase_orders.0.supplier_name', 'Supplement Supplier')
        ->assertJsonPath('data.purchase_orders.0.primary_product.name', 'Whey Protein')
        ->assertJsonPath('data.low_stock_products.0.image_url', url("/api/v1/products/{$product->id}/image"))
        ->assertJsonPath('data.recent_movements.0.reason', 'Stock count correction');
});

test('users without reports permission cannot view inventory logistics summary', function (): void {
    // Captain/Cashier now hold reports.view so they can open the Finance shift
    // desk (see RoleMatrixSeeder + PosAccessSeeder/HrFinanceAccessSeeder), so a
    // roleless user is the honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can('reports.view'))->toBeFalse();

    $this->getJson('/api/v1/reports/inventory-logistics')
        ->assertForbidden();
});
