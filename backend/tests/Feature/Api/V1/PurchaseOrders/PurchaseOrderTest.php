<?php

use App\Models\GymTask;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('manager can create and receive a purchase order', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $product = Product::factory()->create([
        'name' => 'Protein Bar',
        'stock_quantity' => 3,
        'cost' => '20.00',
    ]);

    $createResponse = $this->postJson('/api/v1/purchase-orders', [
        'supplier_name' => 'Gym Supplier',
        'expected_at' => now()->addDays(2)->toDateString(),
        'items' => [
            [
                'product_id' => $product->id,
                'quantity_ordered' => 10,
                'unit_cost' => '18.50',
            ],
        ],
    ]);

    $createResponse
        ->assertCreated()
        ->assertJsonPath('data.supplier_name', 'Gym Supplier')
        ->assertJsonPath('data.items.0.product.name', 'Protein Bar')
        ->assertJsonPath('data.subtotal', '185.00');

    $purchaseOrderId = $createResponse->json('data.id');
    $itemId = $createResponse->json('data.items.0.id');

    $this->postJson("/api/v1/purchase-orders/{$purchaseOrderId}/receive", [
        'items' => [
            [
                'id' => $itemId,
                'quantity_received' => 10,
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'received')
        ->assertJsonPath('data.items.0.quantity_received', 10);

    expect($product->fresh()->stock_quantity)->toBe(13);
    expect(InventoryMovement::query()->where('product_id', $product->id)->where('type', 'in')->sum('quantity'))->toBe(10);
});

test('cashier cannot create purchase orders', function (): void {
    $cashier = User::factory()->create();
    $cashier->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($cashier);

    $product = Product::factory()->create();

    $this->postJson('/api/v1/purchase-orders', [
        'supplier_name' => 'Gym Supplier',
        'items' => [
            [
                'product_id' => $product->id,
                'quantity_ordered' => 10,
                'unit_cost' => '18.50',
            ],
        ],
    ])->assertForbidden();
});

test('manager can create a purchase order with an image and stream it', function (): void {
    Storage::fake('local');

    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $product = Product::factory()->create();
    $file = UploadedFile::fake()->image('invoice.png');

    $createResponse = $this->postJson('/api/v1/purchase-orders', [
        'supplier_name' => 'Gym Supplier',
        'items' => [
            [
                'product_id' => $product->id,
                'quantity_ordered' => 5,
                'unit_cost' => '10.00',
            ],
        ],
        'image' => $file,
    ])->assertCreated();

    $purchaseOrderId = $createResponse->json('data.id');
    $imageUrl = $createResponse->json('data.image_url');
    $imagePath = $createResponse->json('data.image');

    expect($imagePath)->not->toBeNull();
    expect($imageUrl)->toContain("/api/v1/purchase-orders/{$purchaseOrderId}/image");

    Storage::disk('local')->assertExists($imagePath);

    // Assert we can stream the image
    $this->get("/api/v1/purchase-orders/{$purchaseOrderId}/image")
        ->assertOk();
});

test('receiving a purchase order before the expected date creates a gym task', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $product = Product::factory()->create([
        'cost' => '10.00',
    ]);

    $expectedDate = now()->addDays(5)->toDateString();

    $createResponse = $this->postJson('/api/v1/purchase-orders', [
        'supplier_name' => 'Gym Supplier',
        'expected_at' => $expectedDate,
        'items' => [
            [
                'product_id' => $product->id,
                'quantity_ordered' => 5,
                'unit_cost' => '10.00',
            ],
        ],
    ])->assertCreated();

    $purchaseOrderId = $createResponse->json('data.id');
    $itemId = $createResponse->json('data.items.0.id');

    expect(GymTask::query()->where('category', 'inventory')->count())->toBe(0);

    $this->postJson("/api/v1/purchase-orders/{$purchaseOrderId}/receive", [
        'items' => [
            [
                'id' => $itemId,
                'quantity_received' => 5,
            ],
        ],
    ])->assertOk();

    // Verify task was created
    expect(GymTask::query()->where('category', 'inventory')->count())->toBe(1);
    $task = GymTask::query()->where('category', 'inventory')->first();
    expect($task->title)->toContain('received early');
    expect($task->status)->toBe('planned');
});
