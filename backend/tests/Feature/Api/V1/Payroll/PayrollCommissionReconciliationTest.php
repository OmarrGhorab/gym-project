<?php

use App\Actions\Payroll\GeneratePayroll;
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

/**
 * Regression: a commission created by the live observer AFTER payroll has been
 * generated (but before it is paid) must not be silently flipped to "paid"
 * without being paid for. Paying reconciles the month's pending commissions so
 * the payout always equals exactly what is marked paid.
 */
test('paying payroll reconciles commissions created after generation so none are paid without being settled', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create(['base_salary' => '2000.00']);

    // Two commissions exist when payroll is generated.
    Commission::factory()->count(2)->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'amount' => 50.00,
        'status' => 'pending',
    ]);

    app(GeneratePayroll::class)->execute('2026-06');

    $payroll = Payroll::where('employee_id', $employee->id)
        ->where('month', '2026-06')
        ->firstOrFail();

    // Snapshot captured only the two commissions that existed at generation.
    expect($payroll->commissions_total)->toBe('100.00');
    expect($payroll->net_salary)->toBe('2100.00');

    // A late commission arrives for the same month AFTER generation.
    $lateCommission = Commission::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'amount' => 50.00,
        'status' => 'pending',
    ]);

    $this->postJson("/api/v1/payroll/{$payroll->id}/pay")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'paid');

    $payroll->refresh();

    // The late commission is now reflected in the payout — not dropped, not
    // paid for free. Payout reconciles to base + all three commissions.
    expect($payroll->commissions_total)->toBe('150.00');
    expect($payroll->net_salary)->toBe('2150.00');
    expect($lateCommission->fresh()->status)->toBe('paid');

    // The recorded expense payout equals the reconciled net (no drift).
    $expense = Expense::where('category', 'payroll')->latest('id')->first();
    expect($expense)->not->toBeNull();
    expect($expense->amount)->toBe('2150.00');

    // Every settled commission for the month is paid; payout == sum settled.
    $paidCommissionTotal = Commission::where('employee_id', $employee->id)
        ->where('month', '2026-06')
        ->where('status', 'paid')
        ->sum('amount');
    expect(number_format((float) $paidCommissionTotal, 2, '.', ''))->toBe('150.00')
        ->and(bcsub((string) $payroll->net_salary, (string) $payroll->base_salary, 2))->toBe('150.00');
});
