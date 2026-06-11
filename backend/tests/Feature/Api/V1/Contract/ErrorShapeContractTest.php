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

test('validation failure returns 422 with standard error shape', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Make an invalid POST request to trigger validation failure
    $this->postJson('/api/v1/plans', [
        'name' => '', // Required field empty
    ])->assertStatus(422)
        ->assertJsonStructure([
            'error' => [
                'code',
                'message',
                'details',
            ],
        ])
        ->assertJsonPath('error.code', 'validation_failed');
});

test('unauthorized action returns 403 with standard error shape', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    // Cashier does not have access to view audit logs
    $this->getJson('/api/v1/audit-logs')
        ->assertStatus(403)
        ->assertJsonStructure([
            'error' => [
                'code',
                'message',
                'details',
            ],
        ])
        ->assertJsonPath('error.code', 'forbidden');
});

test('model not found returns 404 with standard error shape', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Request non-existent plan ID
    $this->putJson('/api/v1/plans/999999', [
        'name' => 'Non-existent Plan',
    ])
        ->assertStatus(404)
        ->assertJsonStructure([
            'error' => [
                'code',
                'message',
                'details',
            ],
        ])
        ->assertJsonPath('error.code', 'not_found');
});
