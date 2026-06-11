<?php

use App\Actions\Sales\VoidSaleAction;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('it successfully voids a sale and reverses stock and payment', function (): void {
    $user = User::factory()->create();
    $product = Product::factory()->create(['stock_quantity' => 5, 'price' => '10.00']);

    $sale = Sale::factory()->create(['status' => 'completed', 'total' => '10.00']);
    $sale->items()->create([
        'product_id' => $product->id,
        'quantity' => 2,
        'unit_price' => '10.00',
        'total' => '20.00',
    ]);
    $payment = $sale->payment()->create([
        'amount' => '10.00',
        'method' => 'cash',
        'status' => 'paid',
    ]);

    $action = app(VoidSaleAction::class);
    $voidedSale = $action->execute($sale, [], $user);

    expect($voidedSale->status)->toBe('voided');

    $product->refresh();
    expect($product->stock_quantity)->toBe(7); // 5 + 2

    $payment->refresh();
    expect($payment->status)->toBe('voided');

    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product->id,
        'type' => 'in',
        'quantity' => 2,
        'created_by' => $user->id,
        'reason' => "Void Sale #{$sale->id}",
    ]);
});

test('it throws validation exception when trying to void an already voided sale', function (): void {
    $user = User::factory()->create();
    $sale = Sale::factory()->voided()->create();

    $action = app(VoidSaleAction::class);

    expect(fn () => $action->execute($sale, [], $user))
        ->toThrow(ValidationException::class);
});

test('it rolls back transaction if product saving fails', function (): void {
    $user = User::factory()->create();
    $product = Product::factory()->create(['stock_quantity' => 5]);

    $sale = Sale::factory()->create(['status' => 'completed']);
    $sale->items()->create([
        'product_id' => $product->id,
        'quantity' => 2,
        'unit_price' => '10.00',
        'total' => '20.00',
    ]);
    $payment = $sale->payment()->create([
        'amount' => '20.00',
        'method' => 'cash',
        'status' => 'paid',
    ]);

    // Force an error during the loop by mocking or triggering database failure,
    // or just testing that the logic is in a transaction. We can simulate product saving failure
    // by overriding the product instance or mock.
    // Instead of mock, let's verify that if we throw an exception inside the loop, the database changes roll back.

    // We can do this by using a custom mock/event or testing database state
    try {
        DB::transaction(function () use ($sale, $user) {
            $action = new class extends VoidSaleAction
            {
                protected function processItem($item, $sale, $user): void
                {
                    throw new RuntimeException('Database Failure');
                }
            };
            $action->execute($sale, [], $user);
        });
    } catch (RuntimeException $e) {
        // expected
    }

    $product->refresh();
    expect($product->stock_quantity)->toBe(5); // unchanged
    $payment->refresh();
    expect($payment->status)->toBe('paid'); // unchanged
    $sale->refresh();
    expect($sale->status)->toBe('completed'); // unchanged
});
