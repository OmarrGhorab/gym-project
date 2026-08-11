<?php

use App\Actions\Attendance\CheckInEmployeeAttendance;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('employee check in records the arrival time in gym local time', function (): void {
    $shift = EmployeeShift::factory()->create(['name' => 'Morning']);
    $employee = Employee::factory()->create([
        'shift_id' => $shift->id,
    ]);
    $user = User::factory()->create();

    $attendance = app(CheckInEmployeeAttendance::class)->handle([
        'qr_token' => "employee:{$employee->attendance_code}",
        'check_in_at' => '2026-07-05 09:00:00',
    ], $user);

    // Arriving at any hour is simply arriving — there is no schedule to be late against.
    expect($attendance->status)->toBe('present')
        ->and($attendance->shift_id)->toBe($shift->id)
        ->and($attendance->check_in)->format('H:i')->toBe('09:00');
});

test('a check-in with no open desk session falls back to the employee home shift', function (): void {
    $shift = EmployeeShift::factory()->create(['name' => 'Evening']);
    $employee = Employee::factory()->create(['shift_id' => $shift->id]);

    $attendance = app(CheckInEmployeeAttendance::class)->handle([
        'qr_token' => "employee:{$employee->attendance_code}",
        'check_in_at' => '2026-07-05 18:30:00',
    ], User::factory()->create());

    expect($attendance->shift_id)->toBe($shift->id);
});
