<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Member;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Support\Carbon;
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

test('payslip itemizes membership commissions and explains automatic coach bonus', function (): void {
    $this->travelTo(Carbon::parse('2026-07-15 12:00:00'));

    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create([
        'name' => 'Captain Youssef',
        'role' => 'coach',
        'base_salary' => '7500.00',
    ]);
    $member = Member::factory()->create(['name' => 'Mona Hassan']);
    $plan = Plan::factory()->create(['name' => 'Fitness Studio']);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'coach_id' => $employee->id,
        'price_paid' => '6000.00',
        'created_at' => '2026-07-05 10:00:00',
    ]);
    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'coach_id' => $employee->id,
        'start_date' => '2026-07-05',
        'end_date' => '2026-08-05',
        'status' => 'active',
        'price_paid' => '500.00',
        'discount' => '0.00',
        'created_at' => '2026-07-05 10:00:00',
    ]);
    Commission::query()->create([
        'employee_id' => $employee->id,
        'source_type' => Subscription::class,
        'source_id' => $subscription->id,
        'commission_type' => 'subscription_coach',
        'calculation_type' => 'percentage',
        'rate' => '0.0500',
        'rule_value' => '5.0000',
        'amount' => '300.00',
        'month' => '2026-07',
        'status' => 'pending',
    ]);
    $payroll = Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-07',
        'base_salary' => '7500.00',
        'commissions_total' => '300.00',
        'bonuses' => '225.00',
        'net_salary' => '8025.00',
    ]);

    $this->get("/api/v1/payroll/{$payroll->id}/payslip")
        ->assertOk()
        ->assertSee('تفاصيل العمولات', false)
        ->assertSee('Mona Hassan', false)
        ->assertSee('Fitness Studio', false)
        ->assertSee('Membership coaching', false)
        ->assertSee('5%', false)
        ->assertSee('Coach performance bonus', false)
        ->assertSee('3% of base salary', false)
        ->assertSee('225.00', false);

    $this->getJson("/api/v1/payroll/{$payroll->id}/payslip")
        ->assertOk()
        ->assertJsonPath('data.commission_breakdown.0.member_name', 'Mona Hassan')
        ->assertJsonPath('data.commission_breakdown.0.amount', '300.00')
        ->assertJsonPath('data.bonus_breakdown.0.type', 'Coach performance bonus')
        ->assertJsonPath('data.bonus_breakdown.0.amount', '225.00');

    expect($addon->exists)->toBeTrue();
});
