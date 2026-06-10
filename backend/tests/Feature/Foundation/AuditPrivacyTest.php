<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

/**
 * US4 — Record Administrative Activity: audit privacy
 *
 * Verifies that audit records do not include passwords, tokens, or other
 * sensitive personal information (FR-014, Constitution V).
 */
beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
});

test('activity log properties do not contain password field', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    $activity = Activity::latest()->first();
    $propertiesJson = json_encode($activity->properties);

    expect($propertiesJson)->not->toContain('password');
});

test('activity log properties do not contain token field', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    $activity = Activity::latest()->first();
    $propertiesJson = json_encode($activity->properties);

    expect($propertiesJson)->not->toContain('token');
});

test('activity log properties do not contain remember_token field', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    $activity = Activity::latest()->first();
    $propertiesJson = json_encode($activity->properties);

    expect($propertiesJson)->not->toContain('remember_token');
});

test('activity log description is human readable and non-empty', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    $activity = Activity::latest()->first();
    expect($activity->description)->not->toBeEmpty();
});
