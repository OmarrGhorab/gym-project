<?php

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->travelTo(Carbon::parse('2026-08-14 12:00:00'));
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('admin can list every employee and manually record an absence without a deduction', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $active = Employee::factory()->create(['name' => 'Active Employee', 'status' => 'active']);
    Employee::factory()->create(['name' => 'Inactive Employee', 'status' => 'inactive']);

    $this->getJson('/api/v1/employee-absences?month=2026-08')
        ->assertOk()
        ->assertJsonCount(2, 'data.employees')
        ->assertJsonCount(0, 'data.absences');

    $this->postJson('/api/v1/employee-absences', [
        'employee_id' => $active->id,
        'date' => '2026-08-10',
        'reason' => 'Approved family emergency',
        'deduction_amount' => '0.00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.employee.name', 'Active Employee')
        ->assertJsonPath('data.reason', 'Approved family emergency')
        ->assertJsonPath('data.deduction_amount', '0.00');

    $absence = Attendance::query()->sole();

    expect($absence->status)->toBe('absent')
        ->and($absence->check_in)->toBeNull()
        ->and($absence->absence_recorded_by)->toBe($admin->id);
});

test('manual absence deduction is included in payroll generation and payslip details', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create([
        'name' => 'Nour Salem',
        'base_salary' => '5000.00',
    ]);

    $this->postJson('/api/v1/employee-absences', [
        'employee_id' => $employee->id,
        'date' => '2026-08-05',
        'reason' => 'Unapproved absence',
        'deduction_amount' => '250.00',
    ])->assertCreated();

    $this->postJson('/api/v1/payroll/generate?month=2026-08')
        ->assertCreated()
        ->assertJsonPath('data.0.deductions', '0.00')
        ->assertJsonPath('data.0.absence_deductions', '250.00')
        ->assertJsonPath('data.0.total_deductions', '250.00')
        ->assertJsonPath('data.0.absence_count', 1)
        ->assertJsonPath('data.0.net_salary', '4750.00');

    $payroll = Payroll::query()->where('employee_id', $employee->id)->sole();

    $this->getJson("/api/v1/payroll/{$payroll->id}/payslip")
        ->assertOk()
        ->assertJsonPath('data.attendance.absent_count', 1)
        ->assertJsonPath('data.absence_deductions', '250.00')
        ->assertJsonPath('data.absence_breakdown.0.date', '2026-08-05')
        ->assertJsonPath('data.absence_breakdown.0.reason', 'Unapproved absence')
        ->assertJsonPath('data.absence_breakdown.0.deduction_amount', '250.00');

    $this->get("/api/v1/payroll/{$payroll->id}/payslip")
        ->assertOk()
        ->assertSee('Absence details', false)
        ->assertSee('Unapproved absence', false)
        ->assertSee('250.00', false);
});

test('creating updating and deleting an absence keeps pending payroll in sync', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create(['base_salary' => '3000.00']);
    $this->postJson('/api/v1/payroll/generate?month=2026-08')->assertCreated();

    $created = $this->postJson('/api/v1/employee-absences', [
        'employee_id' => $employee->id,
        'date' => '2026-08-06',
        'reason' => 'No show',
        'deduction_amount' => '100.00',
    ])->assertCreated();

    $absenceId = $created->json('data.id');
    expect(Payroll::query()->sole()->fresh()->net_salary)->toBe('2900.00');

    $this->putJson("/api/v1/employee-absences/{$absenceId}", [
        'employee_id' => $employee->id,
        'date' => '2026-08-06',
        'reason' => 'Medical note received',
        'deduction_amount' => '25.00',
    ])->assertOk();

    expect(Payroll::query()->sole()->fresh()->net_salary)->toBe('2975.00');

    $this->deleteJson("/api/v1/employee-absences/{$absenceId}")->assertNoContent();

    $payroll = Payroll::query()->sole()->fresh();
    expect($payroll->absence_deductions)->toBe('0.00')
        ->and($payroll->absence_snapshot)->toBe([])
        ->and($payroll->net_salary)->toBe('3000.00');
});

test('paid payroll locks its absence history', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create();
    Payroll::factory()->paid()->create([
        'employee_id' => $employee->id,
        'month' => '2026-08',
    ]);

    $this->postJson('/api/v1/employee-absences', [
        'employee_id' => $employee->id,
        'date' => '2026-08-07',
        'reason' => 'Late record',
        'deduction_amount' => '50.00',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('error.details.date.0', "This month's payroll is already paid and its absences are locked.");
});

test('accountant cannot manage manual employee absences', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->getJson('/api/v1/employee-absences?month=2026-08')->assertForbidden();
});
