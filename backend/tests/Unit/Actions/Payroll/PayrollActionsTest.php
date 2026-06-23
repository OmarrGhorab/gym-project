<?php

use App\Actions\Payroll\GeneratePayroll;
use App\Actions\Payroll\MarkPayrollPaid;
use App\Actions\Payroll\UpdatePayroll;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Payroll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('generate payroll creates pending record for active employee', function (): void {
    Employee::factory()->create([
        'base_salary' => 2000.00,
        'status' => 'active',
    ]);

    $result = app(GeneratePayroll::class)->execute('2026-06');

    $results = $result['generated'];
    expect($results)->toHaveCount(1)
        ->and($results[0]->base_salary)->toBe('2000.00')
        ->and($results[0]->net_salary)->toBe('2000.00')
        ->and($results[0]->status)->toBe('pending');
});

test('update payroll recomputes net correctly', function (): void {
    $payroll = Payroll::factory()->create([
        'base_salary' => 1500.00,
        'commissions_total' => 300.00,
        'bonuses' => 0.00,
        'deductions' => 0.00,
        'net_salary' => 1800.00,
        'status' => 'pending',
    ]);

    $updated = app(UpdatePayroll::class)->execute($payroll, [
        'bonuses' => 150.00,
        'deductions' => 50.00,
    ]);

    expect($updated->bonuses)->toBe('150.00')
        ->and($updated->deductions)->toBe('50.00')
        ->and($updated->net_salary)->toBe('1900.00'); // 1500 + 300 + 150 - 50
});

test('mark payroll paid creates expense record', function (): void {
    $user = User::factory()->create();
    // No pending commissions exist, so pay-time reconciliation yields
    // net = base + bonuses - deductions = 1750 + 0 - 0.
    $payroll = Payroll::factory()->create([
        'base_salary' => 1750.00,
        'commissions_total' => 0.00,
        'bonuses' => 0.00,
        'deductions' => 0.00,
        'net_salary' => 1750.00,
        'status' => 'pending',
    ]);

    $paid = app(MarkPayrollPaid::class)->execute($payroll, $user);

    expect($paid->status)->toBe('paid')
        ->and($paid->paid_at)->not->toBeNull();

    $expense = Expense::where('category', 'payroll')->first();
    expect($expense)->not->toBeNull()
        ->and($expense->amount)->toBe('1750.00')
        ->and($expense->created_by)->toBe($user->id);
});
