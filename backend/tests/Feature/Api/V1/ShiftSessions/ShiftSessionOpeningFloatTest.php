<?php

use App\Actions\ShiftSessions\OpenShiftSession;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\User;
use App\Support\BusinessDay;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    Notification::fake();
});

afterEach(function (): void {
    Carbon::setTestNow();
});

/** Opens a session at a given wall-clock moment, the way the desk would. */
function openDeskAt(string $moment, EmployeeShift $shift, User $user, Employee $employee): ShiftSession
{
    Carbon::setTestNow(Carbon::parse($moment));

    return app(OpenShiftSession::class)->handle([
        'employee_shift_id' => $shift->id,
        'employee_id' => $employee->id,
    ], $user);
}

/** Finishes a session the way an accepted handover leaves it. */
function resolveDeskWith(ShiftSession $session, string $countedCash, ?string $closedAt = null): void
{
    $session->update([
        'status' => ShiftSession::STATUS_ACCEPTED,
        'closed_at' => $closedAt ? Carbon::parse($closedAt) : now(),
        'counted_cash' => $countedCash,
        'expected_cash' => $countedCash,
    ]);
}

/**
 * The gym closes after midnight, so the shift that finishes the day belongs to
 * the day it started on — and the drawer only goes back to zero when the next
 * working day begins, not when the calendar date changes underneath it.
 */
test('a shift opened after midnight keeps the same working day and its cash', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    $evening = openDeskAt('2026-08-14 20:00:00', $shift, $user, $employee);
    resolveDeskWith($evening, '5000.00', closedAt: '2026-08-15 00:55:00');

    $night = openDeskAt('2026-08-15 01:00:00', $shift, $user, $employee);

    expect($night->business_date->toDateString())->toBe('2026-08-14')
        ->and($night->opening_float)->toBe('5000.00');
});

test('the first shift of the next working day opens on an empty drawer', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    $evening = openDeskAt('2026-08-14 20:00:00', $shift, $user, $employee);
    resolveDeskWith($evening, '5000.00', closedAt: '2026-08-15 00:55:00');

    $night = openDeskAt('2026-08-15 01:00:00', $shift, $user, $employee);
    resolveDeskWith($night, '7000.00', closedAt: '2026-08-15 03:00:00');

    // The takings were banked overnight; the morning starts from nothing.
    $morning = openDeskAt('2026-08-15 09:00:00', $shift, $user, $employee);

    expect($morning->business_date->toDateString())->toBe('2026-08-15')
        ->and($morning->opening_float)->toBe('0.00');
});

/**
 * The gym's real week: open 09:00 until 03:00 the next morning, and on Friday
 * only 14:00 to 19:00. The drawer must follow the trading, not the clock.
 */
test('the drawer follows a full trading night from 9am to 3am', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    $morning = openDeskAt('2026-08-17 09:00:00', $shift, $user, $employee);
    expect($morning->opening_float)->toBe('0.00');
    resolveDeskWith($morning, '2000.00', closedAt: '2026-08-17 17:00:00');

    // Evening takes the drawer straight over from the morning.
    $evening = openDeskAt('2026-08-17 17:05:00', $shift, $user, $employee);
    expect($evening->opening_float)->toBe('2000.00');
    resolveDeskWith($evening, '6000.00', closedAt: '2026-08-18 03:00:00');

    // 03:00 is the end of Monday's trading, not the start of Tuesday's.
    expect($evening->business_date->toDateString())->toBe('2026-08-17');

    // Next morning, after six hours shut: the night's takings were banked.
    $nextMorning = openDeskAt('2026-08-18 09:00:00', $shift, $user, $employee);

    expect($nextMorning->business_date->toDateString())->toBe('2026-08-18')
        ->and($nextMorning->opening_float)->toBe('0.00');
});

test('friday afternoon opens fresh and hands nothing to saturday', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    // Thursday night ran to 03:00 on Friday.
    $thursdayNight = openDeskAt('2026-08-20 20:00:00', $shift, $user, $employee);
    resolveDeskWith($thursdayNight, '4000.00', closedAt: '2026-08-21 03:00:00');

    // Friday 14:00 — eleven hours shut, so the short Friday starts empty.
    $friday = openDeskAt('2026-08-21 14:00:00', $shift, $user, $employee);
    expect($friday->opening_float)->toBe('0.00');
    resolveDeskWith($friday, '900.00', closedAt: '2026-08-21 19:00:00');

    $saturday = openDeskAt('2026-08-22 09:00:00', $shift, $user, $employee);

    expect($saturday->opening_float)->toBe('0.00');
});

/**
 * The reset the gym asked for: driven by the desk having been shut, not by an
 * hour passing. Both shifts here fall inside one working day, so only the
 * closure can account for the drawer being emptied.
 */
test('a long closure ends the day even when the working date has not changed', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    $earlier = openDeskAt('2026-08-17 10:00:00', $shift, $user, $employee);
    resolveDeskWith($earlier, '1500.00', closedAt: '2026-08-17 12:00:00');

    $afterTheGap = openDeskAt('2026-08-17 20:00:00', $shift, $user, $employee);

    expect($afterTheGap->business_date->toDateString())->toBe('2026-08-17')
        ->and($afterTheGap->opening_float)->toBe('0.00');
});

/** A handover between two shifts is minutes apart and must not read as a closure. */
test('a shift handed straight over keeps the drawer', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    $first = openDeskAt('2026-08-17 09:00:00', $shift, $user, $employee);
    resolveDeskWith($first, '3300.00', closedAt: '2026-08-17 15:00:00');

    $second = openDeskAt('2026-08-17 15:10:00', $shift, $user, $employee);

    expect($second->opening_float)->toBe('3300.00');
});

/** A gym that trades later than 05:00 moves the boundary, and the reset follows it. */
test('the drawer resets on the gym\'s own boundary, not the calendar\'s', function (): void {
    Setting::query()->create(['key' => BusinessDay::SETTING_KEY, 'value' => 8]);

    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    $night = openDeskAt('2026-08-15 02:00:00', $shift, $user, $employee);
    resolveDeskWith($night, '4000.00', closedAt: '2026-08-15 06:55:00');

    // 07:00 is still the previous working day for this gym: the cash carries.
    $dawn = openDeskAt('2026-08-15 07:00:00', $shift, $user, $employee);
    expect($dawn->opening_float)->toBe('4000.00');
    resolveDeskWith($dawn, '4500.00', closedAt: '2026-08-15 08:25:00');

    $morning = openDeskAt('2026-08-15 08:30:00', $shift, $user, $employee);

    expect($morning->business_date->toDateString())->toBe('2026-08-15')
        ->and($morning->opening_float)->toBe('0.00');
});

test('cash still carries between shifts inside one working day', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id, 'status' => 'active']);

    $morning = openDeskAt('2026-08-15 09:00:00', $shift, $user, $employee);
    resolveDeskWith($morning, '1200.50', closedAt: '2026-08-15 15:55:00');

    $afternoon = openDeskAt('2026-08-15 16:00:00', $shift, $user, $employee);

    expect($afternoon->opening_float)->toBe('1200.50');
});
