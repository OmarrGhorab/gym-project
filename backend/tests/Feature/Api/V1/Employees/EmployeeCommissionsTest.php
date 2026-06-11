<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Sale;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can list employee commissions filtered by month with total_amount in meta', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $employee = Employee::factory()->create();

    // Create commissions for different months
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-05',
        'amount' => '150.00',
        'source_type' => Sale::class,
        'source_id' => 1,
    ]);

    Commission::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'amount' => '200.00',
        'source_type' => Sale::class,
        'source_id' => 2,
    ]);

    Commission::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'amount' => '300.00',
        'source_type' => Sale::class,
        'source_id' => 3,
    ]);

    // Query for month 2026-06
    $response = $this->getJson("/api/v1/employees/{$employee->id}/commissions?month=2026-06")
        ->assertStatus(200)
        ->assertJsonCount(2, 'data');

    expect($response->json('meta.total_amount'))->toBe('500.00');
});

test('commissions list returns 404 for non-existent employee', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->getJson('/api/v1/employees/9999/commissions')
        ->assertStatus(404);
});

test('user without commissions.view receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $employee = Employee::factory()->create();

    $this->getJson("/api/v1/employees/{$employee->id}/commissions")
        ->assertStatus(403);
});
