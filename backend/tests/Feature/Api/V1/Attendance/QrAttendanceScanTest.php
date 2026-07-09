<?php

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Payroll;
use App\Models\Setting;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\AttendanceRulesSeeder;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

beforeEach(function (): void {
    Carbon::setTestNow();
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
    $this->seed(AttendanceRulesSeeder::class);
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function actingManager(): User
{
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    return $manager;
}

test('member qr check in records allowed visit for active subscription', function (): void {
    actingManager();
    $member = Member::factory()->create(['attendance_code' => 'M-ABC123']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'member:M-ABC123',
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed')
        ->assertJsonPath('data.subscription_id', $subscription->id)
        ->assertJsonPath('data.scan_method', 'qr');
});

test('member check in accepts raw printed attendance code', function (): void {
    actingManager();
    $member = Member::factory()->create(['attendance_code' => 'M-RAW123']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'M-RAW123',
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed')
        ->assertJsonPath('data.subscription_id', $subscription->id)
        ->assertJsonPath('data.member_id', $member->id)
        ->assertJsonPath('data.scan_method', 'qr');
});

test('member qr check in is rejected when member already has an open visit', function (): void {
    actingManager();
    $member = Member::factory()->create(['attendance_code' => 'M-OPEN123']);
    Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);
    MemberVisit::factory()->for($member)->create([
        'check_in_at' => '2026-06-26 09:53:00',
        'check_out_at' => null,
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'member:M-OPEN123',
        'check_in_at' => '2026-06-26 10:07:00',
    ])
        ->assertUnprocessable()
        ->assertJsonFragment([
            'member_id' => ['This member already has an open visit. Check them out before checking in again.'],
        ]);

    expect(MemberVisit::where('member_id', $member->id)->count())->toBe(1);
});

test('member phone lookup records blocked visit for invalid subscription', function (): void {
    actingManager();
    $member = Member::factory()->create(['phone' => '+201111111111']);
    Subscription::factory()->for($member)->expired()->create([
        'start_date' => '2026-05-01',
        'end_date' => '2026-05-31',
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'phone' => '+201111111111',
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'blocked')
        ->assertJsonPath('data.scan_method', 'phone');

    expect(MemberVisit::first()->alert_reason)->toContain('expired');
});

test('member selector lookup does not record the scan as qr', function (): void {
    actingManager();
    $member = Member::factory()->create([
        'attendance_code' => 'M-SELECT123',
        'name' => 'Selected Member',
    ]);
    Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'member_id' => $member->id,
        'name' => $member->name,
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed')
        ->assertJsonPath('data.member_id', $member->id)
        ->assertJsonPath('data.scan_method', 'name');
});

test('member visit outside geofence is flagged not blocked', function (): void {
    actingManager();
    Setting::query()->updateOrCreate(['key' => 'attendance.gym_latitude'], ['value' => 30.0444]);
    Setting::query()->updateOrCreate(['key' => 'attendance.gym_longitude'], ['value' => 31.2357]);
    Setting::query()->updateOrCreate(['key' => 'attendance.gym_radius_meters'], ['value' => 50]);
    $member = Member::factory()->create(['attendance_code' => 'M-GEO']);
    Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'member:M-GEO',
        'check_in_at' => '2026-06-26 10:00:00',
        'latitude' => 31.2001,
        'longitude' => 29.9187,
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'flagged')
        ->assertJsonPath('data.check_in_location.status', 'outside');
});

test('employee qr check in creates late attendance and pending violation', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00',
        'ends_at' => '17:00',
        'grace_minutes' => 15,
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-LATE',
        'shift_id' => $shift->id,
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-LATE',
        'check_in_at' => '2026-06-26 09:45:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'late')
        ->assertJsonPath('data.late_minutes', 30)
        ->assertJsonPath('data.schedule_status', 'late');

    expect(AttendanceViolation::where('employee_id', $employee->id)->first())
        ->not->toBeNull()
        ->status->toBe('pending');
});

test('employee check in accepts raw printed attendance code', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00',
        'ends_at' => '17:00',
        'grace_minutes' => 15,
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-RAW123',
        'shift_id' => $shift->id,
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'E-RAW123',
        'check_in_at' => '2026-06-26 09:05:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.employee_id', $employee->id)
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.schedule_status', 'on_shift')
        ->assertJsonPath('data.scan_method', 'qr');
});

test('employee check in can use selected attendance date', function (): void {
    Carbon::setTestNow('2026-07-09 10:30:00');
    actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00',
        'ends_at' => '17:00',
        'grace_minutes' => 15,
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-HISTORY',
        'shift_id' => $shift->id,
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-HISTORY',
        'attendance_date' => '2026-07-08',
    ])
        ->assertCreated()
        ->assertJsonPath('data.employee_id', $employee->id)
        ->assertJsonPath('data.date', '2026-07-08')
        ->assertJsonPath('data.check_in', '10:30');

    expect(Attendance::where('employee_id', $employee->id)->whereDate('date', '2026-07-08')->exists())->toBeTrue();
});

test('employee check in before shift start is recorded on shift', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '06:00',
        'ends_at' => '14:00',
        'grace_minutes' => 15,
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-EARLY',
        'shift_id' => $shift->id,
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-EARLY',
        'check_in_at' => '2026-06-26 05:45:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.employee_id', $employee->id)
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.late_minutes', 0)
        ->assertJsonPath('data.schedule_status', 'on_shift')
        ->assertJsonPath('data.approval_status', 'approved');
});

test('employee check in on configured off day is approved with shift bonus', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00',
        'ends_at' => '17:00',
        'off_days' => [5],
        'off_day_bonus_enabled' => true,
        'off_day_bonus_amount' => '150.00',
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-OFFDAY',
        'shift_id' => $shift->id,
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-OFFDAY',
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.employee_id', $employee->id)
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.schedule_status', 'off_day')
        ->assertJsonPath('data.approval_status', 'approved')
        ->assertJsonPath('data.off_day_bonus_amount', '150.00');
});

test('employee cannot check in twice on the same day', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00',
        'ends_at' => '17:00',
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-DUPLICATE',
        'shift_id' => $shift->id,
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-DUPLICATE',
        'check_in_at' => '2026-06-26 09:00:00',
    ])->assertCreated();

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-DUPLICATE',
        'check_in_at' => '2026-06-26 09:30:00',
    ])
        ->assertUnprocessable()
        ->assertJsonFragment([
            'employee_id' => ['This employee already checked in today. Check them out or correct the existing attendance record.'],
        ]);

    expect(Attendance::where('employee_id', $employee->id)->whereDate('date', '2026-06-26')->count())->toBe(1)
        ->and(Attendance::where('employee_id', $employee->id)->first()->check_in->format('H:i'))->toBe('09:00');
});

test('employee off day check in syncs bonus into existing pending payroll', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00',
        'ends_at' => '17:00',
        'off_days' => [5],
        'off_day_bonus_enabled' => true,
        'off_day_bonus_amount' => '700.00',
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-PAYROLL-BONUS',
        'base_salary' => '3000.00',
        'shift_id' => $shift->id,
    ]);
    $payroll = Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'base_salary' => '3000.00',
        'commissions_total' => '0.00',
        'bonuses' => '0.00',
        'deductions' => '0.00',
        'attendance_deductions' => '0.00',
        'net_salary' => '3000.00',
        'status' => 'pending',
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-PAYROLL-BONUS',
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.off_day_bonus_amount', '700.00');

    expect($payroll->fresh())
        ->bonuses->toBe('700.00')
        ->net_salary->toBe('3700.00');
});

test('employee off shift check in requires approval violation', function (): void {
    $manager = actingManager();
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00',
        'ends_at' => '17:00',
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-OFF',
        'shift_id' => $shift->id,
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-OFF',
        'check_in_at' => '2026-06-26 23:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.schedule_status', 'off_shift')
        ->assertJsonPath('data.approval_status', 'pending');

    expect(AttendanceViolation::where('employee_id', $employee->id)->where('type', 'off_shift')->exists())->toBeTrue();
    expect(
        $manager->notifications()
            ->get()
            ->contains(fn ($notification): bool => ($notification->data['category'] ?? null) === 'attendance.off_shift')
    )->toBeTrue();
    expect(
        Activity::query()
            ->where('event', 'off_shift')
            ->where('subject_type', Attendance::class)
            ->exists()
    )->toBeTrue();
});

test('manager can edit attendance violation rule penalties', function (): void {
    actingManager();
    $rule = AttendanceViolationRule::query()->where('code', 'late_30')->firstOrFail();

    $this->putJson("/api/v1/attendance/violation-rules/{$rule->id}", [
        'threshold_minutes' => 35,
        'deduction_days' => '0.75',
        'requires_admin_approval' => true,
        'auto_apply_if_unreviewed' => false,
        'is_active' => true,
    ])
        ->assertOk()
        ->assertJsonPath('data.threshold_minutes', 35)
        ->assertJsonPath('data.deduction_days', '0.75')
        ->assertJsonPath('data.auto_apply_if_unreviewed', false);

    expect($rule->fresh())
        ->threshold_minutes->toBe(35)
        ->auto_apply_if_unreviewed->toBeFalse();
});

test('manager cannot rename attendance rule to a custom label', function (): void {
    actingManager();
    $rule = AttendanceViolationRule::query()->where('code', 'late_30')->firstOrFail();

    $this->putJson("/api/v1/attendance/violation-rules/{$rule->id}", [
        'name' => 'Random staff behavior penalty',
        'threshold_minutes' => 35,
        'deduction_days' => '0.75',
    ])
        ->assertUnprocessable();

    expect($rule->fresh()->name)->toBe('Late more than 30 minutes');
});

test('reviewing violation without amount applies salary based estimate', function (): void {
    actingManager();
    $employee = Employee::factory()->create(['base_salary' => '9000.00']);
    $rule = AttendanceViolationRule::query()->where('code', 'late_30')->firstOrFail();
    $violation = AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'attendance_violation_rule_id' => $rule->id,
        'status' => 'pending',
        'deduction_days' => '0.50',
        'deduction_amount' => '0.00',
    ]);

    $this->putJson("/api/v1/attendance/violations/{$violation->id}", [
        'status' => 'approved',
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'approved')
        ->assertJsonPath('data.deduction_amount', '150.00');

    expect($violation->fresh()->deduction_amount)->toBe('150.00');
});
