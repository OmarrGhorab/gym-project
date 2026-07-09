<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Member;
use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('voiding a sale succeeds when no commission is created for pos sales', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Employee::factory()->create([
        'user_id' => $user->id,
        'status' => 'active',
    ]);

    $member = Member::factory()->active()->create();
    $product = Product::factory()->active()->create(['price' => '100.00', 'stock_quantity' => 10]);

    $idempotencyKey = Str::uuid()->toString();

    $saleResponse = $this->postJson('/api/v1/sales', [
        'idempotency_key' => $idempotencyKey,
        'member_id' => $member->id,
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 2],
        ],
    ])->assertStatus(201);

    $saleId = $saleResponse->json('data.id');

    expect(Commission::query()->where('source_id', $saleId)->exists())->toBeFalse();

    // Void the sale
    $this->postJson("/api/v1/sales/{$saleId}/void", [
        'reason' => 'testing void',
    ])->assertStatus(200);
});

test('voided sale restores product stock', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $product = Product::factory()->active()->create(['price' => '50.00', 'stock_quantity' => 10]);

    $idempotencyKey = Str::uuid()->toString();

    $saleResponse = $this->postJson('/api/v1/sales', [
        'idempotency_key' => $idempotencyKey,
        'member_id' => $member->id,
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 3],
        ],
    ])->assertStatus(201);

    $saleId = $saleResponse->json('data.id');

    $product->refresh();
    expect((int) $product->stock_quantity)->toBe(7); // 10 - 3

    $this->postJson("/api/v1/sales/{$saleId}/void", [
        'reason' => 'stock restore test',
    ])->assertStatus(200);

    $product->refresh();
    expect((int) $product->stock_quantity)->toBe(10); // Restored to original
});
