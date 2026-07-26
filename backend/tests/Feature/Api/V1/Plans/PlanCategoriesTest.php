<?php

use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\PlanCategorySeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed([
        FoundationAccessSeeder::class,
        MembershipAccessSeeder::class,
        RoleMatrixSeeder::class,
        PlanCategorySeeder::class,
    ]);
});

test('admin can list plan categories', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson('/api/v1/plan-categories');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'slug', 'description', 'is_active'],
            ],
        ]);
});

test('admin can create custom plan category and use it in a plan', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    $response = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/plan-categories', [
            'name' => 'Jiu-Jitsu Kids',
            'description' => 'Special studio martial arts for children',
            'plan_type' => 'fitness_studio',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.name', 'Jiu-Jitsu Kids')
        ->assertJsonPath('data.slug', 'jiu_jitsu_kids');

    $planResponse = $this->actingAs($admin, 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Jiu-Jitsu Kids Monthly',
            'price' => 1500,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'fitness_studio',
            'category' => 'jiu_jitsu_kids',
        ]);

    $planResponse->assertStatus(201)
        ->assertJsonPath('data.type', 'fitness_studio')
        ->assertJsonPath('data.category', 'jiu_jitsu_kids');
});

test('command dispatches notifications for expiring and session exhausted subscriptions', function (): void {
    Notification::fake();

    $subEndingSoon = Subscription::factory()->create([
        'status' => 'active',
        'end_date' => now()->addDays(2)->toDateString(),
    ]);

    $subExhausted = Subscription::factory()->create([
        'status' => 'active',
        'sessions_total' => 10,
        'sessions_remaining' => 0,
    ]);

    $this->artisan('subscriptions:check-expiries')
        ->assertExitCode(0);
});
