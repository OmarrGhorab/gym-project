<?php

use App\Models\Attendance;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
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
        ->assertStatus(201)
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
        ->assertStatus(201);

    expect(Payroll::count())->toBe(1);

    // Run 2
    $response = $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('meta.refreshed', 1)
        ->assertJsonPath('meta.skipped_existing', 0);

    expect(Payroll::count())->toBe(1);
});

test('regenerating payroll syncs updated employee base salary on pending rows', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create([
        'base_salary' => '0.00',
        'status' => 'active',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('data.0.base_salary', '0.00')
        ->assertJsonPath('data.0.net_salary', '0.00');

    $employee->update(['base_salary' => '5500.00']);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('meta.refreshed', 1)
        ->assertJsonPath('data.0.base_salary', '5500.00')
        ->assertJsonPath('data.0.net_salary', '5500.00');

    expect(Payroll::count())->toBe(1)
        ->and(Payroll::first()->base_salary)->toBe('5500.00')
        ->and(Payroll::first()->net_salary)->toBe('5500.00');
});

test('regenerating payroll keeps the bonus and deduction an admin entered', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('data.0.bonuses', '0.00')
        ->assertJsonPath('data.0.deductions', '0.00');

    $payroll = Payroll::firstOrFail();

    $this->putJson("/api/v1/payroll/{$payroll->id}", [
        'bonuses' => '250.00',
        'deductions' => '100.00',
        'manual_bonus_reason' => 'Covered a colleague for a week.',
        'manual_deduction_reason' => 'Salary advance.',
    ])->assertOk();

    // A late arrival in the same month must not move either figure.
    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-10',
        'status' => 'late',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('meta.refreshed', 1)
        ->assertJsonPath('data.0.bonuses', '250.00')
        ->assertJsonPath('data.0.deductions', '100.00')
        ->assertJsonPath('data.0.net_salary', '3150.00');

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

test('generated payroll starts every bonus and deduction at zero', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);

    // A month full of attendance events that used to move money on their own.
    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-07-06',
        'status' => 'present',
    ]);
    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-07-07',
        'status' => 'late',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-07')
        ->assertStatus(201)
        ->assertJsonPath('data.0.bonuses', '0.00')
        ->assertJsonPath('data.0.deductions', '0.00')
        ->assertJsonPath('data.0.net_salary', '3000.00');

    $this->getJson('/api/v1/payroll?month=2026-07')
        ->assertOk()
        ->assertJsonPath('data.0.bonuses', '0.00')
        ->assertJsonPath('data.0.deductions', '0.00')
        ->assertJsonPath('data.0.net_salary', '3000.00');
});

test('accountant cannot trigger payroll generation and receives 403', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(403);
});
