<?php

use App\Models\Employee;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('generating payroll with zero active employees returns empty result', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    // Ensure no active employees
    Employee::query()->update(['status' => 'inactive']);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('meta.generated', 0);
});
