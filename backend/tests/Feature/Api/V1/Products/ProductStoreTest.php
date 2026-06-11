<?php

use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    Storage::fake('local');
});

test('unauthenticated users cannot store products', function (): void {
    $this->postJson('/api/v1/products', [
        'name' => 'Energy Drink',
        'sku' => 'ENG-1',
        'category' => 'drinks',
        'price' => '25.50',
        'cost' => '15.00',
    ])->assertStatus(401);
});

test('manager with products.create permission can store a product', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/products', [
        'name' => 'Energy Drink',
        'sku' => 'ENG-1',
        'category' => 'drinks',
        'price' => '25.50',
        'cost' => '15.00',
        'stock_quantity' => 10,
        'low_stock_threshold' => 3,
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('data.name', 'Energy Drink')
            ->where('data.sku', 'ENG-1')
            ->where('data.price', '25.50')
            ->where('data.stock_quantity', 10)
        );

    $this->assertDatabaseHas('products', [
        'sku' => 'ENG-1',
        'name' => 'Energy Drink',
    ]);
});

test('cashier without products.create permission gets 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/products', [
        'name' => 'Energy Drink',
        'sku' => 'ENG-1',
        'category' => 'drinks',
        'price' => '25.50',
        'cost' => '15.00',
    ])->assertStatus(403);
});

test('store validation fails for invalid or missing inputs', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    // Missing required fields
    $this->postJson('/api/v1/products', [])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['name', 'sku', 'category', 'price', 'cost']]]);

    // Negative pricing, stock, cost
    $this->postJson('/api/v1/products', [
        'name' => 'Negative pricing product',
        'sku' => 'NEG-1',
        'category' => 'drinks',
        'price' => '-1.00',
        'cost' => '-0.50',
        'stock_quantity' => -10,
        'low_stock_threshold' => -3,
    ])
        ->assertStatus(422);
});

test('cannot store product with duplicate SKU', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    Product::factory()->create(['sku' => 'DUP-1']);

    $this->postJson('/api/v1/products', [
        'name' => 'Duplicate Product',
        'sku' => 'DUP-1',
        'category' => 'drinks',
        'price' => '10.00',
        'cost' => '5.00',
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['sku']]]);
});

test('can upload an image when storing a product', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $image = UploadedFile::fake()->create('whey.jpg', 100, 'image/jpeg');

    $response = $this->postJson('/api/v1/products', [
        'name' => 'Whey Protein',
        'sku' => 'WHEY-99',
        'category' => 'supplements',
        'price' => '450.00',
        'cost' => '300.00',
        'image' => $image,
    ])
        ->assertStatus(201);

    $imageUrl = $response->json('data.image_url');
    expect($imageUrl)->not->toBeNull();

    // Verify file is stored in local disk
    $product = Product::where('sku', 'WHEY-99')->first();
    expect($product->image)->not->toBeNull();
    Storage::disk('local')->assertExists($product->image);
});
