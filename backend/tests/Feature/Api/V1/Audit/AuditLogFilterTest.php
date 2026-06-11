<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('admin can retrieve paginated audit logs filtered by subject alias', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Create activity logs for different subjects
    Activity::create([
        'description' => 'Created member',
        'subject_type' => 'App\Models\Member',
        'subject_id' => 1,
        'causer_type' => 'App\Models\User',
        'causer_id' => $admin->id,
        'created_at' => now()->subMinutes(10),
    ]);

    Activity::create([
        'description' => 'Updated plan',
        'subject_type' => 'App\Models\Plan',
        'subject_id' => 2,
        'causer_type' => 'App\Models\User',
        'causer_id' => $admin->id,
        'created_at' => now()->subMinutes(5),
    ]);

    // Filter by subject=member
    $this->getJson('/api/v1/audit-logs?filter[subject]=member')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.description', 'Created member')
            ->where('data.0.subject.type', 'member')
            ->has('meta')
            ->has('message')
            ->etc()
        );
});

test('admin can filter audit logs by causer ID', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $otherUser = User::factory()->create();

    Activity::create([
        'description' => 'Action by admin',
        'causer_type' => 'App\Models\User',
        'causer_id' => $admin->id,
        'created_at' => now()->subMinutes(10),
    ]);

    Activity::create([
        'description' => 'Action by other',
        'causer_type' => 'App\Models\User',
        'causer_id' => $otherUser->id,
        'created_at' => now()->subMinutes(5),
    ]);

    // Filter by causer=adminId
    $this->getJson("/api/v1/audit-logs?filter[causer]={$admin->id}")
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.description', 'Action by admin')
            ->has('meta')
            ->has('message')
            ->etc()
        );
});

test('admin can filter audit logs by date range', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Old activity
    Activity::create([
        'description' => 'Old action',
        'created_at' => '2026-06-01 10:00:00',
    ]);

    // New activity
    Activity::create([
        'description' => 'New action',
        'created_at' => '2026-06-10 10:00:00',
    ]);

    // Filter by from/to range matching only the new action
    $this->getJson('/api/v1/audit-logs?filter[from]=2026-06-08&filter[to]=2026-06-11')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data', 1)
            ->where('data.0.description', 'New action')
            ->has('meta')
            ->has('message')
            ->etc()
        );
});
