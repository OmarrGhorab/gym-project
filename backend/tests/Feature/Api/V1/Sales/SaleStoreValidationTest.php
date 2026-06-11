<?php

use App\Models\Member;
use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);

    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);
});

test('it validates required fields', function (): void {
    $this->postJson('/api/v1/sales', [])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['idempotency_key', 'payment_method', 'items']]]);
});

test('it validates items must not be empty', function (): void {
    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'items' => [],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['items']]]);
});

test('it validates product must exist and be active', function (): void {
    $inactiveProduct = Product::factory()->create(['is_active' => false]);
    $nonExistentProductId = 99999;

    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $nonExistentProductId, 'quantity' => 1],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['items.0.product_id']]]);

    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $inactiveProduct->id, 'quantity' => 1],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['items.0.product_id']]]);
});

test('it validates stock availability', function (): void {
    $product = Product::factory()->create(['stock_quantity' => 5]);

    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 6],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['items.0.quantity']]]);
});

test('it validates member must exist and be active', function (): void {
    $inactiveMember = Member::factory()->create(['status' => 'inactive']);
    $nonExistentMemberId = 99999;
    $product = Product::factory()->create(['stock_quantity' => 5]);

    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'member_id' => $nonExistentMemberId,
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['member_id']]]);

    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'member_id' => $inactiveMember->id,
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['member_id']]]);
});

test('it validates payment method is valid', function (): void {
    $product = Product::factory()->create(['stock_quantity' => 5]);

    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'invalid_method',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['payment_method']]]);
});

test('it validates discount does not exceed or equal subtotal', function (): void {
    $product = Product::factory()->create(['stock_quantity' => 5, 'price' => '100.00']);

    // Discount equals subtotal
    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'discount' => '100.00',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['discount']]]);

    // Discount exceeds subtotal
    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'discount' => '150.00',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['discount']]]);
});
