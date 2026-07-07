<?php

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
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

test('generating payroll refreshes approved deductions on existing pending payroll', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('data.0.attendance_deductions', '0.00');

    $rule = AttendanceViolationRule::factory()->create([
        'code' => 'late_refresh_test',
        'deduction_days' => '1.00',
        'auto_apply_if_unreviewed' => false,
    ]);
    $attendance = Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-10',
        'status' => 'late',
    ]);
    AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'attendance_id' => $attendance->id,
        'attendance_violation_rule_id' => $rule->id,
        'violation_date' => '2026-06-10',
        'deduction_days' => '1.00',
        'deduction_amount' => '100.00',
        'status' => 'approved',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(201)
        ->assertJsonPath('meta.refreshed', 1)
        ->assertJsonPath('data.0.attendance_deductions', '100.00')
        ->assertJsonPath('data.0.net_salary', '2900.00');

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

test('generating payroll applies unreviewed attendance deductions', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);
    $rule = AttendanceViolationRule::factory()->create([
        'code' => 'late_30_test',
        'deduction_days' => '0.50',
        'auto_apply_if_unreviewed' => true,
    ]);
    $attendance = Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-10',
        'status' => 'late',
    ]);
    AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'attendance_id' => $attendance->id,
        'attendance_violation_rule_id' => $rule->id,
        'violation_date' => '2026-06-10',
        'deduction_days' => '0.50',
        'status' => 'pending',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertCreated()
        ->assertJsonPath('data.0.attendance_deductions', '50.00')
        ->assertJsonPath('data.0.net_salary', '2950.00');

    expect(AttendanceViolation::first()->fresh()->status)->toBe('auto_applied');
});

test('generating payroll includes off day attendance bonuses', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);
    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-26',
        'status' => 'present',
        'schedule_status' => 'off_day',
        'off_day_bonus_amount' => '200.00',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertCreated()
        ->assertJsonPath('data.0.bonuses', '200.00')
        ->assertJsonPath('data.0.net_salary', '3200.00');
});

test('generating payroll includes dynamic clean attendance and coach performance bonuses', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $coach = Employee::factory()->create([
        'base_salary' => '5000.00',
        'role' => 'coach',
    ]);
    $member = Member::factory()->active()->create();
    $basePlan = Plan::factory()->active()->create(['category' => 'gym_access']);
    $servicePlan = Plan::factory()->active()->create(['category' => 'personal_training']);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
        'created_at' => '2026-06-10 10:00:00',
    ]);
    $addon = SubscriptionAddon::create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $servicePlan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'status' => 'active',
        'price_paid' => '1000.00',
    ]);
    $addon->forceFill([
        'created_at' => '2026-06-10 10:00:00',
        'updated_at' => '2026-06-10 10:00:00',
    ])->save();
    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $servicePlan->id,
        'calculation_type' => 'percentage',
        'value' => '20.0000',
        'is_active' => true,
    ]);
    Commission::factory()->create([
        'employee_id' => $coach->id,
        'source_type' => SubscriptionAddon::class,
        'source_id' => $addon->id,
        'amount' => '200.00',
        'month' => '2026-06',
        'status' => 'pending',
    ]);
    Attendance::factory()->create([
        'employee_id' => $coach->id,
        'date' => '2026-06-10',
        'status' => 'present',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertCreated()
        ->assertJsonPath('data.0.commissions_total', '200.00')
        ->assertJsonPath('data.0.bonuses', '250.00')
        ->assertJsonPath('data.0.net_salary', '5450.00');
});

test('generating payroll refreshes off day bonuses on existing pending payroll', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertCreated()
        ->assertJsonPath('data.0.bonuses', '0.00')
        ->assertJsonPath('data.0.net_salary', '3000.00');

    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-26',
        'status' => 'present',
        'schedule_status' => 'off_day',
        'off_day_bonus_amount' => '700.00',
    ]);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertCreated()
        ->assertJsonPath('meta.refreshed', 1)
        ->assertJsonPath('data.0.bonuses', '700.00')
        ->assertJsonPath('data.0.net_salary', '3700.00');

    expect(Payroll::first()->fresh())
        ->bonuses->toBe('700.00')
        ->net_salary->toBe('3700.00');
});

test('payroll index refreshes stale off day bonuses on pending payroll', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);
    Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-07',
        'base_salary' => '3000.00',
        'commissions_total' => '0.00',
        'bonuses' => '0.00',
        'deductions' => '0.00',
        'attendance_deductions' => '0.00',
        'net_salary' => '3000.00',
        'status' => 'pending',
    ]);
    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-07-06',
        'status' => 'present',
        'schedule_status' => 'off_day',
        'off_day_bonus_amount' => '700.00',
    ]);

    $this->getJson('/api/v1/payroll?month=2026-07')
        ->assertOk()
        ->assertJsonPath('data.0.bonuses', '700.00')
        ->assertJsonPath('data.0.net_salary', '3700.00');
});

test('payslip includes dismissed attendance warnings for the payroll month', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employee = Employee::factory()->create([
        'base_salary' => '3000.00',
    ]);
    $payroll = Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'base_salary' => '3000.00',
        'net_salary' => '3000.00',
        'status' => 'pending',
    ]);
    AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'payroll_id' => null,
        'violation_date' => '2026-06-12',
        'type' => 'early_leave',
        'deduction_days' => '0.00',
        'deduction_amount' => '0.00',
        'status' => 'dismissed',
    ]);

    $this->getJson("/api/v1/payroll/{$payroll->id}/payslip", [
        'Accept' => 'application/json',
    ])
        ->assertOk()
        ->assertJsonPath('data.attendance_violations.0.status', 'dismissed')
        ->assertJsonPath('data.attendance_violations.0.type', 'early_leave');
});

test('accountant cannot trigger payroll generation and receives 403', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->postJson('/api/v1/payroll/generate?month=2026-06')
        ->assertStatus(403);
});
