<?php

use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('unauthenticated users cannot list products', function (): void {
    $this->getJson('/api/v1/products')
        ->assertStatus(401);
});

test('cashier with products.view permission can list products', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    Product::factory()->count(3)->create();

    $this->getJson('/api/v1/products')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 3)
            ->has('meta')
            ->has('message')
            ->etc()
        );
});

test('user without products.view permission gets 403', function (): void {
    $user = User::factory()->create();
    // No roles assigned.
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/products')
        ->assertStatus(403);
});

test('can filter products by active status', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    Product::factory()->create(['is_active' => true]);
    Product::factory()->create(['is_active' => false]);

    // Query active only
    $this->getJson('/api/v1/products?filter[is_active]=true')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.is_active', true)
            ->etc()
        );

    // Query inactive only
    $this->getJson('/api/v1/products?filter[is_active]=false')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.is_active', false)
            ->etc()
        );
});

test('can filter products by category', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    Product::factory()->create(['category' => 'drinks']);
    Product::factory()->create(['category' => 'supplements']);

    $this->getJson('/api/v1/products?filter[category]=drinks')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.category', 'drinks')
            ->etc()
        );
});

test('can filter products by low stock flag', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    Product::factory()->create(['stock_quantity' => 10, 'low_stock_threshold' => 5]); // Normal
    Product::factory()->create(['stock_quantity' => 3, 'low_stock_threshold' => 5]);  // Low stock

    $this->getJson('/api/v1/products?filter[is_low_stock]=true')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.is_low_stock', true)
            ->etc()
        );
});

test('can search products by name or SKU', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    Product::factory()->create(['name' => 'Whey Protein High Quality', 'sku' => 'WHEY-1']);
    Product::factory()->create(['name' => 'Water Bottle', 'sku' => 'WATER-9']);

    // Search by name
    $this->getJson('/api/v1/products?filter[search]=protein')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.sku', 'WHEY-1')
            ->etc()
        );

    // Search by SKU
    $this->getJson('/api/v1/products?filter[search]=WATER')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.name', 'Water Bottle')
            ->etc()
        );
});
