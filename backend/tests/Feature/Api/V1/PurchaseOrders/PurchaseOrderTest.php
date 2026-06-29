<?php

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('manager can create and receive a purchase order', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $product = Product::factory()->create([
        'name' => 'Protein Bar',
        'stock_quantity' => 3,
        'cost' => '20.00',
    ]);

    $createResponse = $this->postJson('/api/v1/purchase-orders', [
        'supplier_name' => 'Gym Supplier',
        'expected_at' => now()->addDays(2)->toDateString(),
        'items' => [
            [
                'product_id' => $product->id,
                'quantity_ordered' => 10,
                'unit_cost' => '18.50',
            ],
        ],
    ]);

    $createResponse
        ->assertCreated()
        ->assertJsonPath('data.supplier_name', 'Gym Supplier')
        ->assertJsonPath('data.items.0.product.name', 'Protein Bar')
        ->assertJsonPath('data.subtotal', '185.00');

    $purchaseOrderId = $createResponse->json('data.id');
    $itemId = $createResponse->json('data.items.0.id');

    $this->postJson("/api/v1/purchase-orders/{$purchaseOrderId}/receive", [
        'items' => [
            [
                'id' => $itemId,
                'quantity_received' => 10,
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'received')
        ->assertJsonPath('data.items.0.quantity_received', 10);

    expect($product->fresh()->stock_quantity)->toBe(13);
    expect(InventoryMovement::query()->where('product_id', $product->id)->where('type', 'in')->sum('quantity'))->toBe(10);
});

test('cashier cannot create purchase orders', function (): void {
    $cashier = User::factory()->create();
    $cashier->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($cashier);

    $product = Product::factory()->create();

    $this->postJson('/api/v1/purchase-orders', [
        'supplier_name' => 'Gym Supplier',
        'items' => [
            [
                'product_id' => $product->id,
                'quantity_ordered' => 10,
                'unit_cost' => '18.50',
            ],
        ],
    ])->assertForbidden();
});
