<?php

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

test('unauthenticated users cannot view dashboard sales today widget', function (): void {
    $this->getJson('/api/v1/dashboard/sales-today')->assertStatus(401);
});

test('cashier without reports.view permission cannot view dashboard sales today widget', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/dashboard/sales-today')->assertStatus(403);
});

test('manager can view dashboard sales today count and revenue totals', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    // Sale today
    Sale::factory()->create(['status' => 'completed', 'total' => '120.00', 'created_at' => now()]);

    // Sale yesterday (should be ignored)
    Sale::factory()->create(['status' => 'completed', 'total' => '200.00', 'created_at' => now()->subDay()]);

    // Voided sale today (should be ignored)
    Sale::factory()->voided()->create(['total' => '50.00', 'created_at' => now()]);

    $this->getJson('/api/v1/dashboard/sales-today')
        ->assertStatus(200)
        ->assertJsonPath('data.count', 1)
        ->assertJsonPath('data.revenue', '120.00');
});
