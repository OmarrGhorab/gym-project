<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('authenticated user with reports.view permission can view financial report', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $response = $this->getJson('/api/v1/reports/financial?from=2026-06-01&to=2026-06-05&group_by=day')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['period', 'revenue', 'expenses', 'net_profit'],
            ],
            'meta' => [
                'from',
                'to',
                'group_by',
                'totals' => ['revenue', 'expenses', 'net_profit'],
            ],
            'message',
        ]);
});

test('unauthenticated users cannot view financial report', function (): void {
    $this->getJson('/api/v1/reports/financial?from=2026-06-01&to=2026-06-05&group_by=day')
        ->assertStatus(401);
});

test('users without reports.view permission cannot view financial report', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/financial?from=2026-06-01&to=2026-06-05&group_by=day')
        ->assertStatus(403);
});

test('financial report request validates parameters', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    // Missing parameters
    $this->getJson('/api/v1/reports/financial')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['from', 'to', 'group_by']]]);

    // Invalid parameters
    $this->getJson('/api/v1/reports/financial?from=not-a-date&to=2026-06-01&group_by=invalid')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['from', 'group_by']]]);
});
