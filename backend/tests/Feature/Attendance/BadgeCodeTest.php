<?php

use App\Models\Employee;
use App\Models\Member;
use App\Support\AttendanceCode;

it('assigns a short scannable code when a member is created', function (): void {
    $member = Member::factory()->create(['attendance_code' => null]);

    expect($member->attendance_code)->toStartWith('M-');
    expect(strlen($member->attendance_code))->toBe(2 + AttendanceCode::RANDOM_LENGTH);
});

it('assigns a short scannable code when an employee is created', function (): void {
    $employee = Employee::factory()->create(['attendance_code' => null]);

    expect($employee->attendance_code)->toStartWith('E-');
    expect(strlen($employee->attendance_code))->toBe(2 + AttendanceCode::RANDOM_LENGTH);
});

it('does not reissue a code a member already has', function (): void {
    $member = Member::factory()->create(['attendance_code' => 'M-EXISTS']);

    expect($member->fresh()->attendance_code)->toBe('M-EXISTS');
});
