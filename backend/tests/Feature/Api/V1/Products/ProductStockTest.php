<?php

use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    Storage::fake('local');
});

// ─── POST /products/{id}/stock ───────────────────────────────────────────────

test('manager with inventory.adjust permission can increase stock', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['stock_quantity' => 10]);

    $this->postJson("/api/v1/products/{$product->id}/stock", [
        'type' => 'in',
        'quantity' => 5,
        'reason' => 'Restocking order #123',
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('data.stock_quantity', 15)
        );

    $product->refresh();
    expect($product->stock_quantity)->toBe(15);

    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product->id,
        'type' => 'in',
        'quantity' => 5,
        'reason' => 'Restocking order #123',
        'created_by' => $user->id,
    ]);
});

test('manager with inventory.adjust permission can decrease stock', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['stock_quantity' => 10]);

    $this->postJson("/api/v1/products/{$product->id}/stock", [
        'type' => 'out',
        'quantity' => 3,
        'reason' => 'Damaged inventory sweep',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.stock_quantity', 7);

    $product->refresh();
    expect($product->stock_quantity)->toBe(7);

    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product->id,
        'type' => 'out',
        'quantity' => -3, // Store as negative for type=out per standard audit practices/spec
        'reason' => 'Damaged inventory sweep',
    ]);
});

test('stock decrement fails if quantity exceeds current stock', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['stock_quantity' => 5]);

    $this->postJson("/api/v1/products/{$product->id}/stock", [
        'type' => 'out',
        'quantity' => 6,
        'reason' => 'Too much',
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['quantity']]]);
});

test('cashier without inventory.adjust permission gets 403 on stock adjustment', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER); // Has products.view, but not inventory.adjust
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['stock_quantity' => 10]);

    $this->postJson("/api/v1/products/{$product->id}/stock", [
        'type' => 'in',
        'quantity' => 5,
        'reason' => 'Restock',
    ])->assertStatus(403);
});

// ─── GET /products/{id}/image ────────────────────────────────────────────────

test('can stream product image', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    // Store a fake image in disk
    $imagePath = 'products/fake_image.jpg';
    Storage::disk('local')->put($imagePath, 'fake-binary-content');

    $product = Product::factory()->create(['image' => $imagePath]);

    $response = $this->get("/api/v1/products/{$product->id}/image")
        ->assertStatus(200);

    expect($response->streamedContent())->toBe('fake-binary-content');
});

test('streaming image returns 404 if product has no image', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['image' => null]);

    $this->get("/api/v1/products/{$product->id}/image")
        ->assertStatus(404);
});
