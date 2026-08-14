<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('admin user can access permissions catalog', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/permissions')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('data.system')
            ->has('data.members')
            ->where('data.reports', fn ($permissions): bool => $permissions->contains('reports.view_today'))
            ->has('meta')
            ->has('message')
        );
});

test('non-admin user without roles.manage cannot access permissions catalog', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/permissions')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('unauthenticated request receives 401', function (): void {
    $this->getJson('/api/v1/permissions')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});
