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

test('admin can retrieve payslip as JSON', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $payroll = Payroll::factory()->create();

    $this->getJson("/api/v1/payroll/{$payroll->id}/payslip")
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'employee' => ['id', 'name', 'role'],
                'month',
                'base_salary',
                'commissions',
                'bonuses',
                'deductions',
                'attendance_deductions',
                'attendance_snapshot',
                'net_salary',
            ],
        ]);
});

test('admin can retrieve payslip as PDF stream', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $payroll = Payroll::factory()->create();

    $this->get("/api/v1/payroll/{$payroll->id}/payslip", [
        'Accept' => 'application/pdf',
    ])
        ->assertStatus(200)
        ->assertHeader('Content-Type', 'application/pdf');
});

test('linked employee can retrieve their own payslip as PDF stream', function (): void {
    $employeeUser = User::factory()->create();
    Sanctum::actingAs($employeeUser);

    $payroll = Payroll::factory()
        ->for(Employee::factory()->state(['user_id' => $employeeUser->id]))
        ->create();

    $this->get("/api/v1/payroll/{$payroll->id}/payslip", [
        'Accept' => 'application/pdf',
    ])
        ->assertStatus(200)
        ->assertHeader('Content-Type', 'application/pdf');
});

test('linked employee cannot retrieve another employee payslip', function (): void {
    $employeeUser = User::factory()->create();
    Sanctum::actingAs($employeeUser);

    $payroll = Payroll::factory()->create();

    $this->get("/api/v1/payroll/{$payroll->id}/payslip", [
        'Accept' => 'application/pdf',
    ])
        ->assertForbidden();
});

test('payslip violation table includes manual payroll adjustments', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $payroll = Payroll::factory()->create([
        'month' => '2026-07',
        'bonuses' => '300.00',
        'deductions' => '1000.00',
        'attendance_deductions' => '0.00',
        'net_salary' => '7100.00',
    ]);

    $this->get("/api/v1/payroll/{$payroll->id}/payslip")
        ->assertStatus(200)
        ->assertSee('السلف / الخصم اليدوي', false)
        ->assertSee('بونص / مكافآت', false)
        ->assertSee('مسجل من الإدارة', false)
        ->assertSee('إضافة للراتب', false)
        ->assertSee('1,000.00', false)
        ->assertSee('300.00', false);
});
