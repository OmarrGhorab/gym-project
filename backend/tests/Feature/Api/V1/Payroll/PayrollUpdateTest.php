<?php

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

test('admin can adjust bonuses and deductions of a pending payroll sheet and net recomputes', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);

    $payroll = Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'base_salary' => '3000.00',
        'commissions_total' => '500.00',
        'bonuses' => '0.00',
        'deductions' => '0.00',
        'net_salary' => '3500.00',
        'status' => 'pending',
    ]);

    $this->putJson("/api/v1/payroll/{$payroll->id}", [
        'bonuses' => '200.00',
        'deductions' => '50.00',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.bonuses', '200.00')
        ->assertJsonPath('data.deductions', '50.00')
        ->assertJsonPath('data.net_salary', '3650.00'); // 3000 + 500 + 200 - 50 = 3650
});

test('adjusting payroll rejects negative net salary', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $payroll = Payroll::factory()->create([
        'base_salary' => '1000.00',
        'commissions_total' => '0.00',
        'bonuses' => '0.00',
        'deductions' => '0.00',
        'net_salary' => '1000.00',
        'status' => 'pending',
    ]);

    $this->putJson("/api/v1/payroll/{$payroll->id}", [
        'deductions' => '1100.00', // exceeds salary + commissions
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('adjusting payroll rejects updates on already paid sheets', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $payroll = Payroll::factory()->create([
        'base_salary' => '1000.00',
        'net_salary' => '1000.00',
        'status' => 'paid',
    ]);

    $this->putJson("/api/v1/payroll/{$payroll->id}", [
        'bonuses' => '100.00',
    ])
        ->assertStatus(422);
});
