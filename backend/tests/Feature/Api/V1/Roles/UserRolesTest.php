<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('admin can assign roles to a user', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $targetUser = User::factory()->create();

    $this->postJson("/api/v1/users/{$targetUser->id}/roles", [
        'roles' => [FoundationPermissions::ROLE_CASHIER],
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.id')
            ->has('data.name')
            ->has('data.email')
            ->has('data.roles')
            ->where('data.roles.0', FoundationPermissions::ROLE_CASHIER)
            ->missing('data.password')
            ->missing('data.remember_token')
            ->etc()
        );

    expect($targetUser->fresh()->hasRole(FoundationPermissions::ROLE_CASHIER))->toBeTrue();
});

test('newly granted permission takes effect immediately without re-login', function (): void {
    // 1. Create a user without permissions
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    // Assert that the user cannot view roles (needs roles.manage)
    $this->getJson('/api/v1/roles')
        ->assertStatus(403);

    // 2. Log in as admin, assign the Admin role to the user
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->postJson("/api/v1/users/{$user->id}/roles", [
        'roles' => [FoundationPermissions::ROLE_ADMIN],
    ])->assertStatus(200);

    // 3. Act as the user again (same token/session, meaning we don't re-authenticate or generate a new token)
    Sanctum::actingAs($user->fresh());

    // Assert that the user can now view roles immediately
    $this->getJson('/api/v1/roles')
        ->assertStatus(200);
});

test('assigning unknown roles returns 422', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $targetUser = User::factory()->create();

    $this->postJson("/api/v1/users/{$targetUser->id}/roles", [
        'roles' => ['InvalidRoleName'],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});
