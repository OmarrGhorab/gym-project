<?php

use App\Broadcasting\Events\NewSaleEvent;
use App\Models\Member;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    Event::fake([NewSaleEvent::class]);
});

test('unauthenticated users cannot checkout', function (): void {
    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'items' => [],
        'payment_method' => 'cash',
    ])->assertStatus(401);
});

test('cashier without sales.create permission gets 403', function (): void {
    $user = User::factory()->create();
    // Assign a role that does not have sales.create (e.g. Captain or no role)
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/sales', [
        'idempotency_key' => Str::uuid()->toString(),
        'items' => [],
        'payment_method' => 'cash',
    ])->assertStatus(403);
});

test('cashier can create a sale and atomically deduct stock and write payment', function (): void {
    $user = User::factory()->create(['name' => 'John Cashier']);
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $product1 = Product::factory()->create(['stock_quantity' => 10, 'price' => '100.00']);
    $product2 = Product::factory()->create(['stock_quantity' => 5, 'price' => '50.00']);

    $idempotencyKey = Str::uuid()->toString();

    $response = $this->postJson('/api/v1/sales', [
        'idempotency_key' => $idempotencyKey,
        'member_id' => $member->id,
        'payment_method' => 'cash',
        'discount' => '10.00',
        'notes' => 'Some sale notes',
        'items' => [
            ['product_id' => $product1->id, 'quantity' => 2],
            ['product_id' => $product2->id, 'quantity' => 1],
        ],
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('data.subtotal', '250.00')
            ->where('data.discount', '10.00')
            ->where('data.total', '240.00')
            ->where('data.status', 'completed')
            ->where('data.payment_method', 'cash')
            ->has('data.items', 2)
            ->etc()
        );

    // Verify stock is decremented
    $product1->refresh();
    $product2->refresh();
    expect($product1->stock_quantity)->toBe(8);
    expect($product2->stock_quantity)->toBe(4);

    // Verify inventory movements are logged
    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product1->id,
        'type' => 'out',
        'quantity' => -2,
        'created_by' => $user->id,
    ]);

    $this->assertDatabaseHas('inventory_movements', [
        'product_id' => $product2->id,
        'type' => 'out',
        'quantity' => -1,
        'created_by' => $user->id,
    ]);

    // Verify payment record is created
    $this->assertDatabaseHas('payments', [
        'payable_type' => Sale::class,
        'payable_id' => $response->json('data.id'),
        'amount' => '240.00',
        'method' => 'cash',
        'status' => 'paid',
    ]);

    // Verify broadcast event was dispatched
    Event::assertDispatched(NewSaleEvent::class, function (NewSaleEvent $event) use ($response): bool {
        return $event->saleId === $response->json('data.id') &&
            $event->total === '240.00' &&
            $event->cashierName === 'John Cashier';
    });
});

test('submitting checkout request twice with same idempotency key returns existing sale without double stock deduction', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $product = Product::factory()->create(['stock_quantity' => 10, 'price' => '100.00']);
    $idempotencyKey = Str::uuid()->toString();

    $payload = [
        'idempotency_key' => $idempotencyKey,
        'payment_method' => 'card',
        'items' => [
            ['product_id' => $product->id, 'quantity' => 2],
        ],
    ];

    // First request
    $response1 = $this->postJson('/api/v1/sales', $payload)->assertStatus(201);
    $product->refresh();
    expect($product->stock_quantity)->toBe(8);

    // Second request with same idempotency key
    $response2 = $this->postJson('/api/v1/sales', $payload)->assertStatus(201);

    // Assert same ID returned
    expect($response2->json('data.id'))->toBe($response1->json('data.id'));

    // Assert stock was not decremented again
    $product->refresh();
    expect($product->stock_quantity)->toBe(8);

    // Verify only one sale row exists in DB
    expect(Sale::where('idempotency_key', $idempotencyKey)->count())->toBe(1);
});
