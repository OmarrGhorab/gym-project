<?php

use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    Storage::fake('local');
});

test('unauthenticated users cannot update products or toggle status', function (): void {
    $product = Product::factory()->create();

    $this->putJson("/api/v1/products/{$product->id}", [
        'name' => 'Updated Name',
        'price' => '30.00',
    ])->assertStatus(401);

    $this->patchJson("/api/v1/products/{$product->id}/toggle")
        ->assertStatus(401);
});

test('manager can update a product', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create([
        'name' => 'Old Name',
        'price' => '20.00',
        'sku' => 'SKU-OLD',
    ]);

    $this->putJson("/api/v1/products/{$product->id}", [
        'name' => 'Updated Name',
        'sku' => 'SKU-OLD', // keep SKU
        'category' => 'drinks',
        'price' => '30.00',
        'cost' => '15.00',
        'stock_quantity' => 20,
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.name', 'Updated Name')
        ->assertJsonPath('data.price', '30.00');

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'name' => 'Updated Name',
        'price' => '30.00',
    ]);
});

test('manager can upload new image to replace old one', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create([
        'image' => 'old_path.jpg',
    ]);

    $newImage = UploadedFile::fake()->create('new_whey.jpg', 100, 'image/jpeg');

    $this->putJson("/api/v1/products/{$product->id}", [
        'name' => 'Whey Protein',
        'sku' => $product->sku,
        'category' => $product->category,
        'price' => '50.00',
        'cost' => '30.00',
        'image' => $newImage,
    ])
        ->assertStatus(200);

    $product->refresh();
    expect($product->image)->not->toBe('old_path.jpg');
    Storage::disk('local')->assertExists($product->image);
});

test('updating product validates SKU uniqueness excluding current product', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product1 = Product::factory()->create(['sku' => 'SKU-1']);
    $product2 = Product::factory()->create(['sku' => 'SKU-2']);

    // Attempt to update product2's SKU to SKU-1 (should fail)
    $this->putJson("/api/v1/products/{$product2->id}", [
        'name' => 'Product 2',
        'sku' => 'SKU-1',
        'category' => $product2->category,
        'price' => '10.00',
        'cost' => '5.00',
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['sku']]]);

    // Attempt to update product2 name but keep SKU-2 (should pass)
    $this->putJson("/api/v1/products/{$product2->id}", [
        'name' => 'Updated Product 2',
        'sku' => 'SKU-2',
        'category' => $product2->category,
        'price' => '10.00',
        'cost' => '5.00',
    ])
        ->assertStatus(200);
});

test('manager can toggle product is_active status', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['is_active' => true]);

    $this->patchJson("/api/v1/products/{$product->id}/toggle")
        ->assertStatus(200)
        ->assertJsonPath('data.is_active', false);

    $this->assertDatabaseHas('products', [
        'id' => $product->id,
        'is_active' => false,
    ]);

    $this->patchJson("/api/v1/products/{$product->id}/toggle")
        ->assertStatus(200)
        ->assertJsonPath('data.is_active', true);
});

test('cashier without products.update permission gets 403 on update and toggle', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create();

    $this->putJson("/api/v1/products/{$product->id}", [
        'name' => 'Test',
        'sku' => 'TEST-1',
        'category' => 'drinks',
        'price' => '10.00',
        'cost' => '5.00',
    ])->assertStatus(403);

    $this->patchJson("/api/v1/products/{$product->id}/toggle")
        ->assertStatus(403);
});
