<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Expense;
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

test('admin can pay payroll atomically marking commissions paid and recording a payout expense', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create();

    $commission1 = Commission::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'status' => 'pending',
    ]);

    $commission2 = Commission::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'status' => 'pending',
    ]);

    $payroll = Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'base_salary' => '2000.00',
        'commissions_total' => $commission1->amount + $commission2->amount,
        'bonuses' => '100.00',
        'deductions' => '0.00',
        'net_salary' => 2000.00 + $commission1->amount + $commission2->amount + 100.00,
        'status' => 'pending',
    ]);

    $response = $this->postJson("/api/v1/payroll/{$payroll->id}/pay")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'paid');

    expect($response->json('data.paid_at'))->not->toBeNull();

    // Confirm commissions are paid
    expect($commission1->fresh()->status)->toBe('paid');
    expect($commission2->fresh()->status)->toBe('paid');

    // Confirm an expense payout was recorded
    $expense = Expense::where('category', 'payroll')
        ->where('amount', $payroll->net_salary)
        ->first();

    expect($expense)->not->toBeNull();
    expect($expense->created_by)->toBe($adminUser->id);
});

test('paying already paid payroll returns 409', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $payroll = Payroll::factory()->create([
        'status' => 'paid',
        'paid_at' => now(),
    ]);

    $this->postJson("/api/v1/payroll/{$payroll->id}/pay")
        ->assertStatus(409);
});
