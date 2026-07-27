<?php

use App\Actions\ShiftSessions\SendDailyShiftSummary;
use App\Models\DailyShiftSummary;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
});

test('it sends one daily shift summary after every scheduled shift has ended', function (): void {
    Notification::fake();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    $date = Carbon::parse('2026-07-27')->startOfDay();
    $shift = EmployeeShift::factory()->create([
        'name' => 'Day Desk',
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
    ]);
    $employee = Employee::factory()->create([
        'shift_id' => $shift->id,
        'name' => 'Desk Staff',
        'status' => 'active',
    ]);
    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => $date,
        'opened_at' => $date->copy()->setTime(9, 0),
        'closed_at' => $date->copy()->setTime(17, 0),
        'opened_by' => $admin->id,
        'opened_by_employee_id' => $employee->id,
        'closed_by' => $admin->id,
        'closed_by_employee_id' => $employee->id,
        'status' => ShiftSession::STATUS_ACCEPTED,
        'opening_float' => '100.00',
        'expected_cash' => '150.00',
        'expected_card' => '20.00',
        'expected_bank' => '0.00',
        'expected_expenses' => '10.00',
        'expected_net' => '160.00',
        'counted_cash' => '150.00',
        'counted_card' => '20.00',
        'counted_bank' => '0.00',
        'counted_expenses' => '10.00',
    ]);
    $subscription = Subscription::factory()->active()->create();
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '50.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => $date->copy()->setTime(12, 0),
        'shift_session_id' => $session->id,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '20.00',
        'method' => 'card',
        'status' => 'paid',
        'paid_at' => $date->copy()->setTime(13, 0),
        'shift_session_id' => $session->id,
    ]);
    Expense::factory()->create([
        'amount' => '10.00',
        'date' => $date,
        'shift_session_id' => $session->id,
        'created_by' => $admin->id,
    ]);

    $result = app(SendDailyShiftSummary::class)->handle($date, $date->copy()->setTime(17, 1));

    expect($result)->toMatchArray(['sent' => true, 'reason' => 'sent', 'sessions' => 1])
        ->and(DailyShiftSummary::query()->whereDate('business_date', $date)->value('sent_at'))->not->toBeNull();

    Notification::assertSentTo($admin, OperationalNotification::class, function (OperationalNotification $notification) use ($admin): bool {
        $data = $notification->toArray($admin);

        return $data['category'] === 'shifts.daily_summary'
            && $data['totals']['collections'] === '70.00'
            && $data['totals']['expenses'] === '10.00'
            && $data['totals']['net'] === '160.00'
            && $data['shifts'][0]['shift_name'] === 'Day Desk'
            && $data['shifts'][0]['sessions'][0]['opened_at'] !== null
            && $data['shifts'][0]['sessions'][0]['closed_at'] !== null;
    });

    expect(app(SendDailyShiftSummary::class)->handle($date, $date->copy()->setTime(17, 2)))
        ->toMatchArray(['sent' => false, 'reason' => 'already_sent']);
});

test('it waits until the final active shift has ended', function (): void {
    Notification::fake();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    $date = Carbon::parse('2026-07-27')->startOfDay();
    EmployeeShift::factory()->create([
        'starts_at' => '16:00:00',
        'ends_at' => '21:00:00',
    ]);

    $result = app(SendDailyShiftSummary::class)->handle($date, $date->copy()->setTime(20, 59));

    expect($result)->toMatchArray(['sent' => false, 'reason' => 'shifts_not_finished']);
    Notification::assertNothingSent();
});
