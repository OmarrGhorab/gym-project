<?php

use App\Models\AttendanceViolation;
use App\Models\Employee;
use App\Models\GymTask;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\OperationalNotifier;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function deepLinkAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    return $admin;
}

test('membership notification links to the member it is about', function (): void {
    $admin = deepLinkAdmin();

    $member = Member::factory()->active()->create(['phone' => '01001234567']);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->active()->create()->id,
    ]);

    app(OperationalNotifier::class)->subscriptionEndingSoon($subscription);

    $data = $admin->notifications()->where('data->category', 'membership.expiring_soon')->first()?->data;

    expect($data['url'])->toBe(
        "/dashboard/members?member={$member->id}&q=01001234567&subscription={$subscription->id}"
    )
        ->and($data['link'])->toMatchArray([
            'page' => 'members',
            'entity_type' => 'member',
            'entity_id' => $member->id,
        ]);
});

test('subscription created notification keeps the member phone in the deep link', function (): void {
    $admin = deepLinkAdmin();

    $member = Member::factory()->active()->create(['phone' => '01001234567']);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->active()->create()->id,
    ]);

    $data = $admin->notifications()->where('data->category', 'membership.subscription_created')->first()?->data;

    expect($data['member_phone'])->toBe('01001234567')
        ->and($data['url'])->toBe(
            "/dashboard/members?member={$member->id}&q=01001234567&subscription={$subscription->id}"
        );
});

test('subscription notifications carry every field the whatsapp templates render', function (): void {
    $admin = deepLinkAdmin();

    $member = Member::factory()->active()->create([
        'phone' => '01001234567',
        'attendance_code' => 'ABC234',
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->active()->create(['name' => 'Gold'])->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-09-10',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '450.00',
        'status' => 'paid',
    ]);

    // In the real flow CreateSubscription writes the subscription and its payments in
    // one transaction and the observer notifies afterCommit, so the payment is visible.
    // Factories commit per-row, so drop the observer's notification and re-run it once
    // the payment exists.
    $admin->notifications()->delete();
    app(OperationalNotifier::class)->newSubscription($subscription->fresh());

    $data = $admin->notifications()
        ->where('data->category', 'membership.subscription_created')
        ->first()?->data;

    // An absent key renders as an empty string in the WhatsApp template, so every
    // placeholder the default templates use must be present here.
    expect($data)->toMatchArray([
        'member_name' => $member->name,
        'plan_name' => 'Gold',
        'start_date' => '2026-06-10',
        'end_date' => '2026-09-10',
        'amount_paid' => '450.00',
        'attendance_code' => 'ABC234',
        'attendance_qr' => 'member:ABC234',
    ]);
});

test('expiry reminder notification carries the barcode payload', function (): void {
    $admin = deepLinkAdmin();

    $member = Member::factory()->active()->create(['attendance_code' => 'XYZ789']);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->active()->create()->id,
    ]);

    app(OperationalNotifier::class)->subscriptionEndingSoon($subscription);

    $data = $admin->notifications()->where('data->category', 'membership.expiring_soon')->first()?->data;

    expect($data['attendance_qr'])->toBe('member:XYZ789')
        ->and($data)->toHaveKeys(['start_date', 'amount_paid']);
});

test('payroll notification links to the payroll month of the employee', function (): void {
    $user = User::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id]);
    $payroll = Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
    ]);

    app(OperationalNotifier::class)->payrollReady($payroll);

    $data = $user->notifications()->latest()->first()?->data;

    expect($data['url'])->toBe(
        "/dashboard/payroll?month=2026-06&employee={$employee->id}&payroll={$payroll->id}"
    )
        ->and($data['link'])->toMatchArray([
            'page' => 'payroll',
            'entity_type' => 'payroll',
            'entity_id' => $payroll->id,
        ]);
});

test('attendance warning links to the day sheet and the employee warnings', function (): void {
    $user = User::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id]);
    $violation = AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'violation_date' => '2026-06-09',
        'type' => 'late',
        'deduction_days' => '0.00',
    ]);

    app(OperationalNotifier::class)->employeeAttendanceWarning($violation);

    $data = $user->notifications()->latest()->first()?->data;

    expect($data['url'])->toBe(
        "/dashboard/attendance?date=2026-06-09&employee={$employee->id}&violation={$violation->id}"
        ."&warning_employee_id={$employee->id}&warning_status=all&warning_type=late"
    )
        ->and($data['link']['entity_type'])->toBe('attendance_violation');
});

test('late attendance notification links to the employee day sheet', function (): void {
    $admin = deepLinkAdmin();
    $employee = Employee::factory()->create();

    app(OperationalNotifier::class)->lateAttendance($employee, '2026-06-09', '09:15', 'Morning', 15);

    $data = $admin->notifications()->latest()->first()?->data;

    expect($data['url'])->toBe("/dashboard/attendance?date=2026-06-09&employee={$employee->id}");
});

test('task notification links to the assigned task', function (): void {
    $user = User::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id]);
    $task = GymTask::create([
        'title' => 'Clean the free weights area',
        'status' => 'pending',
        'priority' => 'high',
        'assigned_employee_id' => $employee->id,
        'created_by' => $user->id,
    ]);

    app(OperationalNotifier::class)->taskAssigned($task);

    $data = $user->notifications()->latest()->first()?->data;

    expect($data['url'])->toBe("/dashboard/tasks?task={$task->id}")
        ->and($data['link']['entity_id'])->toBe($task->id);
});
