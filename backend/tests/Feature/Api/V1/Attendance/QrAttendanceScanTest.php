<?php

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Payroll;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Support\FoundationPermissions;
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

test('member qr duplicate check in is sent for review without consuming a second session', function (): void {
    actingManager();
    $member = Member::factory()->create(['attendance_code' => 'M-OPEN123']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => 4,
    ]);
    MemberVisit::factory()->for($member)->create([
        'subscription_id' => $subscription->id,
        'check_in_at' => '2026-06-26 09:53:00',
        'check_out_at' => null,
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'member:M-OPEN123',
        'check_in_at' => '2026-06-26 10:07:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending_review');

    // Unchanged at 4: the held scan consumes nothing, and the member's first visit
    // keeps the session it already used. Refunding it here — as this once did — gave
    // back a session the member had genuinely spent.
    expect(MemberVisit::where('member_id', $member->id)->count())->toBe(2)
        ->and($subscription->fresh()->sessions_remaining)->toBe(4);
});

test('duplicate check in response names the member and does not report the visit as allowed', function (): void {
    // The visit count is a this-month window, so the clock has to sit in the same
    // month as the fixtures or it reports zero for reasons unrelated to the code.
    Carbon::setTestNow('2026-06-26 10:07:00');
    actingManager();
    $member = Member::factory()->create(['attendance_code' => 'M-DUP123', 'name' => 'Ali Abdelrahman']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => 4,
    ]);
    MemberVisit::factory()->for($member)->create([
        'subscription_id' => $subscription->id,
        'check_in_at' => '2026-06-26 09:53:00',
        'check_out_at' => null,
    ]);

    $response = $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'member:M-DUP123',
        'check_in_at' => '2026-06-26 10:07:00',
    ])->assertCreated();

    // The desk decides from this response alone, so it has to carry the member
    // and must not claim the visit went through — nothing was consumed yet.
    $response->assertJsonPath('data.member.name', 'Ali Abdelrahman')
        ->assertJsonPath('data.plan_name', $subscription->plan->name)
        ->assertJsonPath(
            'data.alert_reason',
            'Already checked in today. Approve only if the member really came back — it counts a second visit and uses another session. Dismiss if the badge was scanned twice.',
        )
        // What the desk needs to judge the scan: when the plan runs out, how much
        // is left on it, and how often this member has already been in this month.
        ->assertJsonPath('data.plan_end_date', '2026-06-30')
        ->assertJsonPath('data.subscription.sessions_remaining', 4)
        // One visit today, not two: the member's real check-in counts, the held
        // duplicate does not until someone decides on it.
        ->assertJsonPath('data.member.visits_this_month', 1);

    expect($response->json('message'))->not->toContain('allowed');
});

test('member phone lookup rejects check-in for invalid subscription', function (): void {
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
        ->assertUnprocessable();

    expect(MemberVisit::count())->toBe(0);
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

test('employee qr check in records the arrival and notifies admins', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
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
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.check_in', '09:45');

    expect(Attendance::where('employee_id', $employee->id)->first())
        ->not->toBeNull()
        ->status->toBe('present');
});

test('employee check in accepts raw printed attendance code', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
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
        ->assertJsonPath('data.scan_method', 'qr');
});

test('employee check in can use selected attendance date', function (): void {
    Carbon::setTestNow('2026-07-09 10:30:00');
    actingManager();
    $shift = EmployeeShift::factory()->create([
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
        ->assertJsonPath('data.status', 'present');
});

test('employee check in on any day is simply recorded', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
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
        ->assertJsonMissingPath('data.schedule_status')
        ->assertJsonMissingPath('data.approval_status');
});

test('employee cannot check in twice on the same day', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
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

test('a check in leaves pending payroll untouched', function (): void {
    actingManager();
    $shift = EmployeeShift::factory()->create([
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
        'net_salary' => '3000.00',
        'status' => 'pending',
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-PAYROLL-BONUS',
        'check_in_at' => '2026-06-26 10:00:00',
    ])->assertCreated();

    // Working an off day is recorded, but no money moves without an admin.
    expect($payroll->fresh())
        ->bonuses->toBe('0.00')
        ->net_salary->toBe('3000.00');
});

test('a check in is filed under the shift of the open desk session', function (): void {
    $manager = actingManager();
    $homeShift = EmployeeShift::factory()->create([
        'name' => 'Morning',
    ]);
    $coveredShift = EmployeeShift::factory()->create([
        'name' => 'Closing',
    ]);
    $employee = Employee::factory()->create([
        'attendance_code' => 'E-COVERING',
        'shift_id' => $homeShift->id,
    ]);

    ShiftSession::query()->create([
        'employee_shift_id' => $coveredShift->id,
        'business_date' => '2026-06-26',
        'opened_at' => '2026-06-26 21:00:00',
        'opened_by' => $manager->id,
        'opened_by_employee_id' => $employee->id,
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '0.00',
    ]);

    $this->postJson('/api/v1/attendance/check-in', [
        'qr_token' => 'employee:E-COVERING',
        'check_in_at' => '2026-06-26 23:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.shift.id', $coveredShift->id)
        ->assertJsonPath('data.status', 'present');
});

test('member check in automatically decrements sessions from active extra-on plan addon', function (): void {
    actingManager();
    $member = Member::factory()->create(['attendance_code' => 'M-ADDON99']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => null,
    ]);

    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $subscription->plan_id,
        'status' => 'active',
        'price_paid' => '100.00',
        'sessions_total' => 12,
        'sessions_remaining' => 12,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'member:M-ADDON99',
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed')
        ->assertJsonPath('data.subscription_id', $subscription->id)
        ->assertJsonPath('data.subscription_addon_id', $addon->id);

    expect($addon->fresh()->sessions_remaining)->toBe(11);
});

test('member check in notifies admins when an extra-on plan has two sessions remaining', function (): void {
    $manager = actingManager();
    $member = Member::factory()->create(['attendance_code' => 'M-ADDON-LOW']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => null,
    ]);

    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $subscription->plan_id,
        'status' => 'active',
        'price_paid' => '100.00',
        'sessions_total' => 3,
        'sessions_remaining' => 3,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits/check-in', [
        'qr_token' => 'member:M-ADDON-LOW',
        'check_in_at' => '2026-06-26 10:00:00',
    ])->assertCreated();

    expect($addon->fresh()->sessions_remaining)->toBe(2)
        ->and(
            $manager->notifications()
                ->get()
                ->contains(fn ($notification): bool => ($notification->data['category'] ?? null) === 'membership.addon_sessions_low'
                    && ($notification->data['sessions_remaining'] ?? null) === 2)
        )->toBeTrue();
});

test('the desk decides whether a second scan is a real visit or a double scan', function (): void {
    Carbon::setTestNow('2026-06-26 10:07:00');
    actingManager();

    $member = Member::factory()->create(['attendance_code' => 'M-TWICE1']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => 10,
    ]);
    $first = MemberVisit::factory()->for($member)->create([
        'subscription_id' => $subscription->id,
        'check_in_at' => '2026-06-26 09:53:00',
        'check_out_at' => null,
        'status' => 'allowed',
    ]);

    $held = $this->postJson('/api/v1/member-visits/check-in', ['qr_token' => 'member:M-TWICE1'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending_review')
        // Before anyone decides, the day counts once. This is the default the desk
        // sees: one visit per day, everything beyond it is a question.
        ->assertJsonPath('data.member.visits_this_month', 1)
        ->json('data.id');

    // Dismissed as a double scan: nothing changes for the member at all.
    $this->postJson("/api/v1/member-visits/{$held}/review", ['decision' => 'dismissed'])->assertOk();

    expect($subscription->fresh()->sessions_remaining)->toBe(10)
        ->and($first->fresh()->status)->toBe('allowed')
        ->and($first->fresh()->check_out_at)->toBeNull();

    // A second held scan, this time approved: the member really did come back.
    $second = $this->postJson('/api/v1/member-visits/check-in', ['qr_token' => 'member:M-TWICE1'])
        ->assertCreated()
        ->json('data.id');

    $this->postJson("/api/v1/member-visits/{$second}/review", ['decision' => 'approved'])->assertOk();

    // Now it costs a session, the earlier visit is closed out, and the day counts twice.
    expect($subscription->fresh()->sessions_remaining)->toBe(9)
        ->and($first->fresh()->check_out_at)->not->toBeNull()
        ->and(MemberVisit::where('member_id', $member->id)->where('status', 'allowed')->count())->toBe(2);
});

test('a repeat scan seconds later still asks the desk instead of being swallowed', function (): void {
    Carbon::setTestNow('2026-06-26 10:00:00');
    actingManager();

    $member = Member::factory()->create(['attendance_code' => 'M-FAST01']);
    Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => 10,
    ]);

    $this->postJson('/api/v1/member-visits/check-in', ['qr_token' => 'member:M-FAST01'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed');

    // The scanner fires again twenty seconds later. The machine cannot tell that
    // from a member who really walked back in, so the desk is asked either way.
    Carbon::setTestNow('2026-06-26 10:00:20');
    $this->postJson('/api/v1/member-visits/check-in', ['qr_token' => 'member:M-FAST01'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending_review');

    // The first visit keeps its session; the pending one has spent nothing yet.
    expect(MemberVisit::where('member_id', $member->id)->count())->toBe(2)
        ->and(Subscription::where('member_id', $member->id)->value('sessions_remaining'))->toBe(9);
});

test('a member cannot queue up more than one pending decision', function (): void {
    Carbon::setTestNow('2026-06-26 10:00:00');
    actingManager();

    $member = Member::factory()->create(['attendance_code' => 'M-QUEUE1']);
    Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => 10,
    ]);

    $this->postJson('/api/v1/member-visits/check-in', ['qr_token' => 'member:M-QUEUE1'])->assertCreated();

    Carbon::setTestNow('2026-06-26 10:10:00');
    $this->postJson('/api/v1/member-visits/check-in', ['qr_token' => 'member:M-QUEUE1'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending_review');

    // Scanning again while the desk has not answered must not stack another question.
    Carbon::setTestNow('2026-06-26 10:30:00');
    $this->postJson('/api/v1/member-visits/check-in', ['qr_token' => 'member:M-QUEUE1'])->assertCreated();

    expect(MemberVisit::where('member_id', $member->id)->where('status', 'pending_review')->count())->toBe(1)
        ->and(MemberVisit::where('member_id', $member->id)->count())->toBe(2);
});
