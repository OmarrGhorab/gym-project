<?php

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\OperationsCalendarEvent;
use App\Models\Payroll;
use App\Models\User;
use App\Support\FoundationPermissions;
use Carbon\Carbon;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can view staff academy summary', function (): void {
    Carbon::setTestNow('2026-06-29 10:30:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $shift = EmployeeShift::factory()->create([
        'name' => 'Morning 9-5',
        'starts_at' => '09:00',
        'ends_at' => '17:00',
    ]);
    $employee = Employee::factory()->create([
        'name' => 'Coach Ahmed',
        'role' => 'Captain',
        'shift_id' => $shift->id,
        'status' => 'active',
    ]);

    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-06-29',
        'status' => 'late',
        'late_minutes' => 20,
    ]);
    AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'attendance_id' => null,
        'violation_date' => '2026-06-29',
        'type' => 'late',
        'status' => 'pending',
    ]);
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '150.00',
        'created_at' => '2026-06-29 10:00:00',
    ]);
    Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'status' => 'pending',
    ]);
    OperationsCalendarEvent::factory()->create([
        'date' => '2026-07-01',
        'title' => 'Staff training',
        'type' => 'training',
    ]);

    $this->getJson('/api/v1/reports/staff-academy')
        ->assertOk()
        ->assertJsonPath('data.kpis.0.value', 1)
        ->assertJsonPath('data.kpis.2.value', 1)
        ->assertJsonPath('data.shift_schedule.0.name', 'Morning 9-5')
        ->assertJsonPath('data.warning_status.0.pending', 1)
        ->assertJsonPath('data.performance_highlights.0.name', 'Coach Ahmed')
        ->assertJsonFragment(['title' => 'Staff training'])
        ->assertJsonStructure([
            'data' => [
                'generated_at',
                'kpis',
                'shift_schedule',
                'warning_status',
                'performance_highlights',
                'upcoming_events',
                'today' => ['checked_in', 'late', 'off_shift', 'pending_approval'],
            ],
        ]);
});

test('users without reports permission cannot view staff academy summary', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/staff-academy')
        ->assertForbidden();
});
