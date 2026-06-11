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

test('unauthenticated users cannot view dashboard top products widget', function (): void {
    $this->getJson('/api/v1/dashboard/top-products')->assertStatus(401);
});

test('cashier without reports.view permission cannot view dashboard top products widget', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/dashboard/top-products')->assertStatus(403);
});

test('manager can view dashboard top products ranking grouped and ordered by revenue', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $productA = Product::factory()->create(['name' => 'Product Alpha']);
    $productB = Product::factory()->create(['name' => 'Product Beta']);

    $sale1 = Sale::factory()->create(['status' => 'completed', 'created_at' => now()]);
    $sale1->items()->create(['product_id' => $productA->id, 'quantity' => 2, 'unit_price' => '50.00', 'total' => '100.00']);

    $sale2 = Sale::factory()->create(['status' => 'completed', 'created_at' => now()]);
    $sale2->items()->create(['product_id' => $productB->id, 'quantity' => 1, 'unit_price' => '200.00', 'total' => '200.00']);

    // product B should be rank 1 ($200), product A rank 2 ($100)
    $response = $this->getJson('/api/v1/dashboard/top-products?period=week&limit=5')
        ->assertStatus(200)
        ->assertJsonCount(2, 'data');

    expect($response->json('data.0.name'))->toBe('Product Beta')
        ->and($response->json('data.0.revenue'))->toBe('200.00')
        ->and($response->json('data.1.name'))->toBe('Product Alpha')
        ->and($response->json('data.1.revenue'))->toBe('100.00');
});

test('it validates period and limit query inputs', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    // Invalid period
    $this->getJson('/api/v1/dashboard/top-products?period=year')
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['period']]]);

    // Invalid limit
    $this->getJson('/api/v1/dashboard/top-products?limit=50')
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['limit']]]);
});
