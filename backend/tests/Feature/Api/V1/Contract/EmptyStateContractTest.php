<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('empty members list returns 200 with empty data array', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/members')
        ->assertStatus(200)
        ->assertJsonCount(0, 'data')
        ->assertJsonStructure([
            'data',
            'meta',
            'message',
        ]);
});

test('empty payments list returns 200 with empty data array', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/payments')
        ->assertStatus(200)
        ->assertJsonCount(0, 'data')
        ->assertJsonStructure([
            'data',
            'meta',
            'message',
        ]);
});
