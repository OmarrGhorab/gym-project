<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('admin can generate payroll for active employees and net recomputes correctly', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $user = User::factory()->create();
    $employee = Employee::factory()->captain()->create([
        'user_id' => $user->id,
        'base_salary' => '4000.00',
    ]);

    // Create commissions for this month
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '150.00',
        'month' => '2026-06',
        'status' => 'pending',
    ]);

    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '250.00',
        'month' => '2026-06',
        'status' => 'pending',
    ]);

    // Commission for another month (should be excluded)
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '300.00',
        'month' => '2026-05',
        'status' => 'pending',
    ]);

    // Inactive employee (should be excluded)
    Employee::factory()->create([
        'status' => 'inactive',
    ]);

    $response = $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.base_salary', '4000.00')
        ->assertJsonPath('data.0.commissions_total', '400.00')
        ->assertJsonPath('data.0.net_salary', '4400.00');

    expect(Payroll::count())->toBe(1);
});

test('generating payroll is idempotent on re-run', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);

    // Run 1
    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(200);

    expect(Payroll::count())->toBe(1);

    // Run 2
    $response = $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(200)
        ->assertJsonPath('meta.skipped_existing', 1);

    expect(Payroll::count())->toBe(1);
});

test('generating payroll validation rejects invalid month format', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $this->postJson('/api/v1/payroll/generate?month=2026/06')
        ->assertStatus(422);

    $this->postJson('/api/v1/payroll/generate?month=06-2026')
        ->assertStatus(422);
});

test('accountant cannot trigger payroll generation and receives 403', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(403);
});
