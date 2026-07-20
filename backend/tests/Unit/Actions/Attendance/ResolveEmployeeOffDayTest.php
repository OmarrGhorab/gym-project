<?php

use App\Actions\Attendance\ResolveEmployeeOffDay;
use App\Models\Employee;
use App\Models\EmployeeOffDayOverride;
use App\Models\EmployeeShift;
use App\Models\ShiftOffRotation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

test('rotation assigns one employee off on the weekday each week', function (): void {
    $shift = EmployeeShift::factory()->create(['off_days' => []]);
    $employees = Employee::factory()->count(3)->create(['shift_id' => $shift->id]);
    $order = $employees->pluck('id')->all();

    ShiftOffRotation::query()->create([
        'employee_shift_id' => $shift->id,
        'off_weekday' => Carbon::FRIDAY, // 5
        'rotation_start_date' => '2026-06-07', // Sunday start of week containing first Friday 2026-06-12
        'employee_order' => $order,
        'is_active' => true,
    ]);

    $resolver = app(ResolveEmployeeOffDay::class);

    // Friday week 0 -> employee 0
    expect($resolver->handle($employees[0], Carbon::parse('2026-06-12'), $shift))->toBeTrue()
        ->and($resolver->handle($employees[1], Carbon::parse('2026-06-12'), $shift))->toBeFalse()
        ->and($resolver->handle($employees[2], Carbon::parse('2026-06-12'), $shift))->toBeFalse();

    // Friday week 1 -> employee 1
    expect($resolver->handle($employees[0], Carbon::parse('2026-06-19'), $shift))->toBeFalse()
        ->and($resolver->handle($employees[1], Carbon::parse('2026-06-19'), $shift))->toBeTrue();

    // Non-Friday is never rotation off
    expect($resolver->handle($employees[0], Carbon::parse('2026-06-13'), $shift))->toBeFalse();
});

test('override forces work or off and beats rotation', function (): void {
    $shift = EmployeeShift::factory()->create(['off_days' => []]);
    $employee = Employee::factory()->create(['shift_id' => $shift->id]);

    ShiftOffRotation::query()->create([
        'employee_shift_id' => $shift->id,
        'off_weekday' => Carbon::FRIDAY,
        'rotation_start_date' => '2026-06-07',
        'employee_order' => [$employee->id],
        'is_active' => true,
    ]);

    EmployeeOffDayOverride::query()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-12',
        'type' => 'work',
    ]);

    $resolver = app(ResolveEmployeeOffDay::class);

    expect($resolver->handle($employee, Carbon::parse('2026-06-12'), $shift))->toBeFalse();

    EmployeeOffDayOverride::query()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-13',
        'type' => 'off',
    ]);

    expect($resolver->handle($employee, Carbon::parse('2026-06-13'), $shift))->toBeTrue();
});

test('falls back to static shift off_days when rotation inactive', function (): void {
    $shift = EmployeeShift::factory()->create(['off_days' => [5]]);
    $employee = Employee::factory()->create(['shift_id' => $shift->id]);

    $resolver = app(ResolveEmployeeOffDay::class);

    expect($resolver->handle($employee, Carbon::parse('2026-06-12'), $shift))->toBeTrue()
        ->and($resolver->handle($employee, Carbon::parse('2026-06-13'), $shift))->toBeFalse();
});
