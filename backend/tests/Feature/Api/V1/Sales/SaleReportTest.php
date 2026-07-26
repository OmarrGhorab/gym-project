<?php

use App\Models\Product;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\PosPermissions;
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
    // Cashier deliberately holds reports.view (PosAccessSeeder / RoleMatrixSeeder)
    // so front desk can open the Finance shift desk, so a roleless user is the
    // honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can(PosPermissions::PERM_REPORTS_VIEW))->toBeFalse();

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

test('day report includes membership subscriptions even without pos sales', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    Subscription::factory()->create([
        'created_at' => '2026-07-07 10:00:00',
        'sold_by_user_id' => $user->id,
    ]);

    $response = $this->getJson('/api/v1/sales/report?from=2026-07-07&to=2026-07-07&group_by=day')
        ->assertStatus(200);

    expect($response->json('data.data.0.date'))->toBe('2026-07-07');
    expect($response->json('data.data.0.revenue'))->toBe('0.00');
    expect($response->json('data.data.0.sales_count'))->toBe(0);
    expect($response->json('data.data.0.units_sold'))->toBe(0);
    expect($response->json('data.data.0.membership_subscriptions'))->toBe(1);
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

test('period sales report accepts seller_id as cashier filter alias', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $seller = User::factory()->create(['name' => 'Seller Sara']);
    $otherSeller = User::factory()->create();

    $from = now()->subDays(5)->toDateString();
    $to = now()->toDateString();

    $sale = Sale::factory()->create(['status' => 'completed', 'total' => '80.00', 'sold_by_user_id' => $seller->id]);
    $sale->items()->create(['product_id' => Product::factory()->create()->id, 'quantity' => 2, 'unit_price' => '40.00', 'total' => '80.00']);
    $otherSale = Sale::factory()->create(['status' => 'completed', 'total' => '25.00', 'sold_by_user_id' => $otherSeller->id]);
    $otherSale->items()->create(['product_id' => Product::factory()->create()->id, 'quantity' => 1, 'unit_price' => '25.00', 'total' => '25.00']);

    $response = $this->getJson("/api/v1/sales/report?from={$from}&to={$to}&group_by=cashier&seller_id={$seller->id}")
        ->assertStatus(200);

    expect($response->json('data.data.0.cashier_name'))->toBe('Seller Sara');
    expect($response->json('data.data.0.revenue'))->toBe('80.00');
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

test('manager can run transaction-level sales period report', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $seller = User::factory()->create(['name' => 'Seller Noor']);
    $product = Product::factory()->create(['name' => 'Protein Bar', 'sku' => 'PB-1']);
    $from = now()->subDays(5)->toDateString();
    $to = now()->toDateString();

    $sale = Sale::factory()->create([
        'status' => 'completed',
        'total' => '60.00',
        'payment_method' => 'cash',
        'sold_by_user_id' => $seller->id,
        'created_at' => now(),
    ]);
    $sale->items()->create([
        'product_id' => $product->id,
        'quantity' => 3,
        'unit_price' => '20.00',
        'total' => '60.00',
    ]);

    $response = $this->getJson("/api/v1/sales/report?from={$from}&to={$to}&group_by=transaction&seller_id={$seller->id}&product_id={$product->id}")
        ->assertStatus(200);

    expect($response->json('data.data.0.sale_id'))->toBe($sale->id);
    expect($response->json('data.data.0.product_name'))->toBe('Protein Bar');
    expect($response->json('data.data.0.cashier_name'))->toBe('Seller Noor');
    expect($response->json('data.data.0.line_total'))->toBe('60.00');
});
