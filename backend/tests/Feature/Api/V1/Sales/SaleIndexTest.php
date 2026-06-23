<?php

use App\Models\Member;
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

test('unauthenticated users cannot view sales list or detail', function (): void {
    $sale = Sale::factory()->create();

    $this->getJson('/api/v1/sales')->assertStatus(401);
    $this->getJson("/api/v1/sales/{$sale->id}")->assertStatus(401);
});

test('users without sales.view permission cannot view sales list or detail', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $sale = Sale::factory()->create();

    $this->getJson('/api/v1/sales')->assertStatus(403);
    $this->getJson("/api/v1/sales/{$sale->id}")->assertStatus(403);
});

test('authorized cashier can list sales with pagination and filters', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $member1 = Member::factory()->create();
    $member2 = Member::factory()->create();

    $sale1 = Sale::factory()->create(['member_id' => $member1->id, 'status' => 'completed']);
    $sale2 = Sale::factory()->create(['member_id' => $member2->id, 'status' => 'voided']);

    // List all
    $this->getJson('/api/v1/sales')
        ->assertStatus(200)
        ->assertJsonCount(2, 'data');

    // Filter by status
    $this->getJson('/api/v1/sales?filter[status]=completed')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $sale1->id);

    // Filter by member_id
    $this->getJson("/api/v1/sales?filter[member_id]={$member2->id}")
        ->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $sale2->id);
});

test('authorized cashier can view single sale details', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $sale = Sale::factory()->create();

    $this->getJson("/api/v1/sales/{$sale->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.id', $sale->id);
});

test('viewing a non-existent sale returns 404', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/sales/999999')->assertStatus(404);
});
