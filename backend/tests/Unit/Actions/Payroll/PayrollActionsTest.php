<?php

namespace Tests\Unit\Actions\Payroll;

use App\Actions\Payroll\GeneratePayroll;
use App\Actions\Payroll\MarkPayrollPaid;
use App\Actions\Payroll\UpdatePayroll;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Payroll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollActionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_generate_payroll_creates_pending_record_for_active_employee(): void
    {
        $employee = Employee::factory()->create([
            'base_salary' => 2000.00,
            'status' => 'active',
        ]);

        $action = app(GeneratePayroll::class);
        $results = $action->execute('2026-06');

        $this->assertCount(1, $results);
        $this->assertEquals('2000.00', $results[0]->base_salary);
        $this->assertEquals('2000.00', $results[0]->net_salary);
        $this->assertEquals('pending', $results[0]->status);
    }

    public function test_update_payroll_recomputes_net_correctly(): void
    {
        $payroll = Payroll::factory()->create([
            'base_salary' => 1500.00,
            'commissions_total' => 300.00,
            'bonuses' => 0.00,
            'deductions' => 0.00,
            'net_salary' => 1800.00,
            'status' => 'pending',
        ]);

        $action = app(UpdatePayroll::class);
        $updated = $action->execute($payroll, [
            'bonuses' => 150.00,
            'deductions' => 50.00,
        ]);

        $this->assertEquals('150.00', $updated->bonuses);
        $this->assertEquals('50.00', $updated->deductions);
        $this->assertEquals('1900.00', $updated->net_salary); // 1500 + 300 + 150 - 50 = 1900
    }

    public function test_mark_payroll_paid_creates_expense_record(): void
    {
        $user = User::factory()->create();
        // No pending commissions exist, so the pay-time reconciliation yields
        // net = base + bonuses - deductions = 1750 + 0 - 0.
        $payroll = Payroll::factory()->create([
            'base_salary' => 1750.00,
            'commissions_total' => 0.00,
            'bonuses' => 0.00,
            'deductions' => 0.00,
            'net_salary' => 1750.00,
            'status' => 'pending',
        ]);

        $action = app(MarkPayrollPaid::class);
        $paid = $action->execute($payroll, $user);

        $this->assertEquals('paid', $paid->status);
        $this->assertNotNull($paid->paid_at);

        $expense = Expense::where('category', 'payroll')->first();
        $this->assertNotNull($expense);
        $this->assertEquals('1750.00', $expense->amount);
        $this->assertEquals($user->id, $expense->created_by);
    }
}
