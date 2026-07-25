<?php

use App\Models\Plan;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('authenticated user can list plans and filter by search term, type, and active status', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Plan::factory()->create([
        'name' => 'VIP Gold Membership',
        'description' => 'Unlimited gym access',
        'type' => 'membership',
        'is_active' => true,
    ]);

    Plan::factory()->create([
        'name' => 'Pilates Special Offer',
        'description' => '10 sessions package',
        'type' => 'fitness_studio',
        'is_active' => false,
    ]);

    // Search by name
    $response = $this->getJson('/api/v1/plans?filter[search]=Gold');
    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'VIP Gold Membership');

    // Search by description
    $response = $this->getJson('/api/v1/plans?filter[search]=package');
    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Pilates Special Offer');

    // Filter by type
    $response = $this->getJson('/api/v1/plans?filter[type]=fitness_studio');
    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Pilates Special Offer');

    // Filter by status
    $response = $this->getJson('/api/v1/plans?filter[is_active]=0');
    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Pilates Special Offer');
});
