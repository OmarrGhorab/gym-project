<?php

use App\Actions\Attendance\ResolveEmployeeOffDay;
use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\ShiftOffRotation;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\AttendanceRulesSeeder;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);

    $this->manager = User::factory()->create();
    $this->manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($this->manager);
});

/** A plain working shift with no off days, so nothing is reclassified as off_day. */
function workingShift(array $overrides = []): EmployeeShift
{
    return EmployeeShift::factory()->create(array_merge([
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
        'grace_minutes' => 15,
        'off_days' => [],
    ], $overrides));
}

/*
|--------------------------------------------------------------------------
| Admin correcting attendance for staff who forgot to scan
|--------------------------------------------------------------------------
*/

test('recording a forgotten late arrival derives the lateness from the corrected time', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    // Arrived 09:30 against a 09:00 shift with 15 minutes grace => 15 minutes late.
    $response = $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '09:30',
        'status' => 'late',
    ])->assertStatus(201);

    expect($response->json('data.late_minutes'))->toBe(15);
});

test('recording a forgotten on-time arrival leaves no lateness', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $response = $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '09:10',
        'status' => 'present',
    ])->assertStatus(201);

    expect($response->json('data.late_minutes'))->toBe(0);
});

test('correcting a check-out derives the early leave minutes', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $attendance = Attendance::factory()->create([
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '09:00',
        'check_out' => null,
        'status' => 'present',
    ]);

    // Left at 16:00 against a 17:00 shift end => 60 minutes early.
    $response = $this->putJson("/api/v1/attendance/{$attendance->id}", [
        'check_out' => '16:00',
    ])->assertStatus(200);

    expect($response->json('data.early_leave_minutes'))->toBe(60);
});

test('correcting a wrongly recorded late arrival clears the lateness', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $attendance = Attendance::factory()->create([
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '10:00',
        'status' => 'late',
        'late_minutes' => 45,
    ]);

    // The employee actually arrived on time; the scan was simply missed.
    $response = $this->putJson("/api/v1/attendance/{$attendance->id}", [
        'check_in' => '09:05',
        'status' => 'present',
    ])->assertStatus(200);

    expect($response->json('data.late_minutes'))->toBe(0);
});

test('an admin can log a completely missed day for an employee who was present', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $created = $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-21',
        'check_in' => '09:00',
        'check_out' => '17:00',
        'status' => 'present',
        'notes' => 'Scanner was down; confirmed by the floor manager.',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.check_in', '09:00')
        ->assertJsonPath('data.check_out', '17:00')
        ->assertJsonPath('data.status', 'present')
        // A full, on-time day carries no penalty minutes.
        ->assertJsonPath('data.late_minutes', 0)
        ->assertJsonPath('data.early_leave_minutes', 0);

    // And it is readable back through the API.
    $this->getJson('/api/v1/attendance/'.$created->json('data.id'))
        ->assertOk()
        ->assertJsonPath('data.check_in', '09:00');
});

/*
|--------------------------------------------------------------------------
| Whether a manual correction carries a payroll penalty
|--------------------------------------------------------------------------
*/

test('a manually recorded late arrival raises a warning by default', function (): void {
    $this->seed(AttendanceRulesSeeder::class);

    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $created = $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '10:00',
        'status' => 'late',
    ])->assertStatus(201);

    $violation = AttendanceViolation::query()
        ->where('attendance_id', $created->json('data.id'))
        ->where('type', 'late')
        ->first();

    expect($violation)->not->toBeNull()
        ->and($violation->minutes)->toBe(45);
});

test('an admin can waive the penalty when fixing a scanner fault', function (): void {
    $this->seed(AttendanceRulesSeeder::class);

    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $created = $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '10:00',
        'status' => 'late',
        'apply_penalty' => false,
        'notes' => 'Scanner was offline; arrival time confirmed by CCTV.',
    ])->assertStatus(201);

    // The lateness is still on the record for reporting...
    expect($created->json('data.late_minutes'))->toBe(45)
        // ...but nothing reaches payroll.
        ->and(AttendanceViolation::query()
            ->where('attendance_id', $created->json('data.id'))
            ->whereIn('status', ['warning', 'pending', 'approved', 'auto_applied'])
            ->exists())->toBeFalse();
});

test('correcting a wrong late scan retires the warning it created', function (): void {
    $this->seed(AttendanceRulesSeeder::class);

    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    // A genuine late scan, penalised.
    $created = $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '10:00',
        'status' => 'late',
    ])->assertStatus(201);

    $attendanceId = $created->json('data.id');
    expect(AttendanceViolation::query()->where('attendance_id', $attendanceId)->exists())->toBeTrue();

    // It turns out the clock was wrong — they were on time.
    $this->putJson("/api/v1/attendance/{$attendanceId}", [
        'check_in' => '09:05',
        'status' => 'present',
    ])->assertStatus(200);

    $violation = AttendanceViolation::query()->where('attendance_id', $attendanceId)->first();

    expect($violation->status)->toBe('dismissed');
});

/*
|--------------------------------------------------------------------------
| Rotational off days
|--------------------------------------------------------------------------
*/

test('the rotation moves the off day to the next employee each week', function (): void {
    $shift = workingShift(['off_days' => []]);
    $a = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    $b = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    $c = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    // Rotation anchored on a Sunday; the off weekday is Tuesday (2).
    ShiftOffRotation::query()->create([
        'employee_shift_id' => $shift->id,
        'off_weekday' => 2,
        'rotation_start_date' => '2026-07-05',
        'employee_order' => [$a->id, $b->id, $c->id],
        'is_active' => true,
    ]);

    $resolver = app(ResolveEmployeeOffDay::class);

    // 2026-07-07, 07-14, 07-21 are consecutive Tuesdays.
    expect($resolver->handle($a, Carbon::parse('2026-07-07'), $shift))->toBeTrue()
        ->and($resolver->handle($b, Carbon::parse('2026-07-07'), $shift))->toBeFalse()
        ->and($resolver->handle($b, Carbon::parse('2026-07-14'), $shift))->toBeTrue()
        ->and($resolver->handle($a, Carbon::parse('2026-07-14'), $shift))->toBeFalse()
        ->and($resolver->handle($c, Carbon::parse('2026-07-21'), $shift))->toBeTrue()
        // Wraps back to the first employee on the fourth week.
        ->and($resolver->handle($a, Carbon::parse('2026-07-28'), $shift))->toBeTrue();
});

test('nobody is off on a weekday the rotation does not cover', function (): void {
    $shift = workingShift(['off_days' => []]);
    $a = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    ShiftOffRotation::query()->create([
        'employee_shift_id' => $shift->id,
        'off_weekday' => 2,
        'rotation_start_date' => '2026-07-05',
        'employee_order' => [$a->id],
        'is_active' => true,
    ]);

    // 2026-07-08 is a Wednesday.
    expect(app(ResolveEmployeeOffDay::class)
        ->handle($a, Carbon::parse('2026-07-08'), $shift))->toBeFalse();
});

test('an employee off by rotation is not offered as an uncovered overtime slot', function (): void {
    $shift = workingShift(['off_days' => []]);
    $offToday = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    $working = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $tuesday = Carbon::parse('2026-07-07');

    ShiftOffRotation::query()->create([
        'employee_shift_id' => $shift->id,
        'off_weekday' => 2,
        'rotation_start_date' => '2026-07-05',
        'employee_order' => [$offToday->id, $working->id],
        'is_active' => true,
    ]);

    // Neither checked in, but only the working one is a genuine gap to cover.
    $response = $this->getJson('/api/v1/overtime-shifts/candidates?date='.$tuesday->toDateString())
        ->assertOk();

    $ids = collect($response->json('data'))->pluck('employee.id')->all();

    expect($ids)->toContain($working->id)
        ->and($ids)->not->toContain($offToday->id);
});
