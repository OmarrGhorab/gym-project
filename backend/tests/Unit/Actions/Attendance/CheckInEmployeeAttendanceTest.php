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

test('employee check in after shift grace is marked late in gym local time', function (): void {
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '06:00',
        'ends_at' => '14:00',
        'grace_minutes' => 10,
    ]);
    $employee = Employee::factory()->create([
        'shift_id' => $shift->id,
    ]);
    $user = User::factory()->create();

    $attendance = app(CheckInEmployeeAttendance::class)->handle([
        'qr_token' => "employee:{$employee->attendance_code}",
        'check_in_at' => '2026-07-05 09:00:00',
    ], $user);

    expect($attendance->status)->toBe('late')
        ->and($attendance->schedule_status)->toBe('late')
        ->and($attendance->late_minutes)->toBe(170)
        ->and($attendance->check_in)->format('H:i')->toBe('09:00');
});
