<?php

use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('unauthenticated users cannot void a sale', function (): void {
    $sale = Sale::factory()->create();

    $this->postJson("/api/v1/sales/{$sale->id}/void")
        ->assertStatus(401);
});

test('cashier without sales.void permission cannot void a sale', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $sale = Sale::factory()->create();

    $this->postJson("/api/v1/sales/{$sale->id}/void")
        ->assertStatus(403);
});

test('manager with sales.void permission can void a completed sale, restoring stock and updating payment status', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product1 = Product::factory()->create(['stock_quantity' => 10, 'price' => '10.00']);
    $product2 = Product::factory()->create(['stock_quantity' => 5, 'price' => '20.00']);

    // Ring up a sale
    $sale = Sale::factory()->create([
        'subtotal' => '40.00',
        'total' => '40.00',
        'status' => 'completed',
    ]);

    $item1 = $sale->items()->create([
        'product_id' => $product1->id,
        'quantity' => 2,
        'unit_price' => '10.00',
        'total' => '20.00',
    ]);

    $item2 = $sale->items()->create([
        'product_id' => $product2->id,
        'quantity' => 1,
        'unit_price' => '20.00',
        'total' => '20.00',
    ]);

    $payment = $sale->payment()->create([
        'amount' => '40.00',
        'method' => 'cash',
        'status' => 'paid',
    ]);

    // Update stock levels to reflect pre-void state (as if they were already decremented)
    $product1->update(['stock_quantity' => 8]);
    $product2->update(['stock_quantity' => 4]);

    $this->postJson("/api/v1/sales/{$sale->id}/void", [
        'reason' => 'Customer returned items',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'voided');

    // Verify stock is restored
    $product1->refresh();
    $product2->refresh();
    expect($product1->stock_quantity)->toBe(10);
    expect($product2->stock_quantity)->toBe(5);

    // Verify reversal inventory movements are written
    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product1->id,
        'type' => 'in',
        'quantity' => 2,
        'created_by' => $user->id,
        'reason' => "Void Sale #{$sale->id}",
    ]);

    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product2->id,
        'type' => 'in',
        'quantity' => 1,
        'created_by' => $user->id,
        'reason' => "Void Sale #{$sale->id}",
    ]);

    // Verify payment record status is reversed to voided
    $payment->refresh();
    expect($payment->status)->toBe('voided');

    // Verify sale status is voided
    $sale->refresh();
    expect($sale->status)->toBe('voided');
});

test('manager cannot void an already voided sale', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $sale = Sale::factory()->voided()->create();

    $this->postJson("/api/v1/sales/{$sale->id}/void")
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['sale']]]);
});

test('voiding non-existent sale returns 404', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/sales/99999/void')
        ->assertStatus(404);
});
