<?php

use App\Actions\Sales\CreateSaleAction;
use App\Broadcasting\Events\NewSaleEvent;
use App\Models\Member;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    Event::fake([NewSaleEvent::class]);
});

test('it creates a sale successfully with correct mathematical totals and stock reduction', function (): void {
    $user = User::factory()->create();
    $member = Member::factory()->create();
    $product1 = Product::factory()->create(['stock_quantity' => 10, 'price' => '100.50']);
    $product2 = Product::factory()->create(['stock_quantity' => 5, 'price' => '49.99']);

    $action = app(CreateSaleAction::class);

    $idempotencyKey = Str::uuid()->toString();

    $sale = $action->execute([
        'idempotency_key' => $idempotencyKey,
        'member_id' => $member->id,
        'payment_method' => 'cash',
        'discount' => '10.25',
        'notes' => 'Test notes',
        'items' => [
            ['product_id' => $product1->id, 'quantity' => 2],
            ['product_id' => $product2->id, 'quantity' => 1],
        ],
    ], $user);

    expect($sale)->toBeInstanceOf(Sale::class);
    // Subtotal: 2 * 100.50 + 1 * 49.99 = 201.00 + 49.99 = 250.99
    // Discount: 10.25
    // Total: 250.99 - 10.25 = 240.74
    expect($sale->subtotal)->toBe('250.99');
    expect($sale->discount)->toBe('10.25');
    expect($sale->total)->toBe('240.74');
    expect($sale->payment_method)->toBe('cash');
    expect($sale->status)->toBe('completed');
    expect($sale->sold_by_user_id)->toBe($user->id);

    // Verify database updates
    $product1->refresh();
    $product2->refresh();
    expect($product1->stock_quantity)->toBe(8);
    expect($product2->stock_quantity)->toBe(4);

    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product1->id,
        'type' => 'out',
        'quantity' => -2,
        'created_by' => $user->id,
    ]);

    $this->assertDatabaseHas('payments', [
        'payable_type' => Sale::class,
        'payable_id' => $sale->id,
        'amount' => '240.74',
        'method' => 'cash',
        'status' => 'paid',
    ]);

    Event::assertDispatched(NewSaleEvent::class);
});

test('it returns existing sale if idempotency key is matched', function (): void {
    $user = User::factory()->create();
    $product = Product::factory()->create(['stock_quantity' => 10, 'price' => '50.00']);
    $idempotencyKey = Str::uuid()->toString();

    $action = app(CreateSaleAction::class);

    $payload = [
        'idempotency_key' => $idempotencyKey,
        'payment_method' => 'card',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ];

    $sale1 = $action->execute($payload, $user);
    $product->refresh();
    expect($product->stock_quantity)->toBe(9);

    // Run again
    $sale2 = $action->execute($payload, $user);

    expect($sale2->id)->toBe($sale1->id);
    $product->refresh();
    expect($product->stock_quantity)->toBe(9); // No extra decrement
});

test('it throws validation exception on insufficient stock', function (): void {
    $user = User::factory()->create();
    $product = Product::factory()->create(['stock_quantity' => 2, 'price' => '50.00']);
    $action = app(CreateSaleAction::class);

    expect(fn () => $action->execute([
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 3],
        ],
    ], $user))->toThrow(ValidationException::class);
});

test('it throws validation exception on inactive product', function (): void {
    $user = User::factory()->create();
    $product = Product::factory()->create(['stock_quantity' => 10, 'is_active' => false]);
    $action = app(CreateSaleAction::class);

    expect(fn () => $action->execute([
        'idempotency_key' => Str::uuid()->toString(),
        'payment_method' => 'cash',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
    ], $user))->toThrow(ValidationException::class);
});
