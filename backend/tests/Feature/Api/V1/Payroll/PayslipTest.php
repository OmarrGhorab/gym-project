<?php

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
