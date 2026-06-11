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

test('unauthenticated users cannot view periodic sales report', function (): void {
    $this->getJson('/api/v1/sales/report')->assertStatus(401);
});

test('users without reports.view permission cannot view periodic sales report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/sales/report')->assertStatus(403);
});

test('it validates required period parameters and max range limit of 366 days', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    // Missing from and to and group_by
    $this->getJson('/api/v1/sales/report')
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['from', 'to', 'group_by']]]);

    // Range exceeding 366 days
    $from = now()->subDays(400)->toDateString();
    $to = now()->toDateString();
    $this->getJson("/api/v1/sales/report?from={$from}&to={$to}&group_by=day")
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['from']]]);
});

test('manager can run report grouped by day', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $from = now()->subDays(5)->toDateString();
    $to = now()->toDateString();

    $sale = Sale::factory()->create(['status' => 'completed', 'total' => '150.00', 'created_at' => now()]);
    $sale->items()->create(['product_id' => Product::factory()->create()->id, 'quantity' => 3, 'unit_price' => '50.00', 'total' => '150.00']);

    $response = $this->getJson("/api/v1/sales/report?from={$from}&to={$to}&group_by=day")
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'meta', 'message']);

    expect($response->json('data.data'))->not->toBeEmpty();
    expect($response->json('data.data.0.revenue'))->toBe('150.00');
    expect($response->json('data.data.0.units_sold'))->toBe(3);
});

test('manager can run report grouped by cashier', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $cashier = User::factory()->create(['name' => 'Cashier Bob']);
    $cashier->assignRole(FoundationPermissions::ROLE_CASHIER);

    $from = now()->subDays(5)->toDateString();
    $to = now()->toDateString();

    $sale = Sale::factory()->create(['status' => 'completed', 'total' => '50.00', 'sold_by_user_id' => $cashier->id]);
    $sale->items()->create(['product_id' => Product::factory()->create()->id, 'quantity' => 1, 'unit_price' => '50.00', 'total' => '50.00']);

    $response = $this->getJson("/api/v1/sales/report?from={$from}&to={$to}&group_by=cashier&cashier_id={$cashier->id}")
        ->assertStatus(200);

    expect($response->json('data.data.0.cashier_name'))->toBe('Cashier Bob');
    expect($response->json('data.data.0.revenue'))->toBe('50.00');
    expect($response->json('data.data.0.units_sold'))->toBe(1);
});

test('manager can run report grouped by product', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['name' => 'Energy Shake']);

    $from = now()->subDays(5)->toDateString();
    $to = now()->toDateString();

    $sale = Sale::factory()->create(['status' => 'completed', 'total' => '10.00']);
    $sale->items()->create(['product_id' => $product->id, 'quantity' => 2, 'unit_price' => '5.00', 'total' => '10.00']);

    $response = $this->getJson("/api/v1/sales/report?from={$from}&to={$to}&group_by=product&product_id={$product->id}")
        ->assertStatus(200);

    expect($response->json('data.data.0.product_name'))->toBe('Energy Shake');
    expect($response->json('data.data.0.revenue'))->toBe('10.00');
    expect($response->json('data.data.0.units_sold'))->toBe(2);
});
