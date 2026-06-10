<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

/**
 * US4 — Record Administrative Activity: audit log creation
 *
 * Verifies that calling the protected sample endpoint creates an audit
 * record with the required actor, event, and context fields.
 */
beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
});

test('accessing protected sample endpoint creates an activity log record', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    expect(Activity::count())->toBeGreaterThan(0);
});

test('activity log record contains the correct event name', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    $activity = Activity::latest()->first();
    expect($activity->event)->toBe('foundation.sample-accessed');
});

test('activity log record identifies the actor correctly', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    $activity = Activity::latest()->first();
    expect($activity->causer_id)->toBe($user->id);
    expect($activity->causer_type)->toBe(User::class);
});

test('activity log record has the foundation log name', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')->assertStatus(200);

    $activity = Activity::latest()->first();
    expect($activity->log_name)->toBe('foundation');
});
