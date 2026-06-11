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

test('unauthenticated users cannot view a receipt', function (): void {
    $sale = Sale::factory()->create();

    $this->getJson("/api/v1/sales/{$sale->id}/receipt")->assertStatus(401);
});

test('cashier with sales.view permission can view receipt as HTML or PDF', function (): void {
    $user = User::factory()->create(['name' => 'Cashier Jack']);
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['name' => 'Water Bottle', 'price' => '10.00']);
    $sale = Sale::factory()->create(['total' => '10.00', 'sold_by_user_id' => $user->id]);
    $sale->items()->create([
        'product_id' => $product->id,
        'quantity' => 1,
        'unit_price' => '10.00',
        'total' => '10.00',
    ]);

    // HTML Receipt View
    $responseHtml = $this->get("/api/v1/sales/{$sale->id}/receipt")
        ->assertStatus(200)
        ->assertHeader('Content-Type', 'text/html; charset=UTF-8');

    expect($responseHtml->getContent())->toContain('Water Bottle')
        ->toContain('Cashier Jack')
        ->toContain('10.00');

    // PDF Receipt View
    $responsePdf = $this->get("/api/v1/sales/{$sale->id}/receipt", [
        'Accept' => 'application/pdf',
    ])
        ->assertStatus(200)
        ->assertHeader('Content-Type', 'application/pdf');

    expect($responsePdf->getContent())->not->toBeEmpty();
});

test('users without sales.view permission cannot view a receipt', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $sale = Sale::factory()->create();

    $this->get("/api/v1/sales/{$sale->id}/receipt")->assertStatus(403);
});

test('viewing receipt of non-existent sale returns 404', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->get('/api/v1/sales/99999/receipt')->assertStatus(404);
});
