<?php

use App\Models\Attendance;
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
        'status' => 'present',
        'check_in' => '09:20',
        'check_out' => null,
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

    $this->getJson('/api/v1/reports/staff-academy?from=2026-06-01&to=2026-06-30')
        ->assertOk()
        ->assertJsonPath('data.period.from', '2026-06-01')
        ->assertJsonPath('data.period.to', '2026-06-30')
        ->assertJsonPath('data.kpis.0.value', 1)
        ->assertJsonPath('data.kpis.2.value', 1)
        ->assertJsonPath('data.shift_schedule.0.name', 'Morning 9-5')
        ->assertJsonPath('data.attendance_exceptions.1.pending', 1)
        ->assertJsonPath('data.performance_highlights.0.name', 'Coach Ahmed')
        ->assertJsonFragment(['title' => 'Staff training'])
        ->assertJsonFragment(['title' => 'Coach Ahmed salary receipt'])
        ->assertJsonStructure([
            'data' => [
                'generated_at',
                'period' => ['from', 'to'],
                'kpis',
                'shift_schedule',
                'attendance_exceptions',
                'performance_highlights',
                'upcoming_events',
                'today' => ['checked_in', 'absent', 'still_in'],
            ],
        ]);
});

test('users without reports permission cannot view staff academy summary', function (): void {
    // Captain/Cashier now hold reports.view so they can open the Finance shift
    // desk (see RoleMatrixSeeder + PosAccessSeeder/HrFinanceAccessSeeder), so a
    // roleless user is the honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can('reports.view'))->toBeFalse();

    $this->getJson('/api/v1/reports/staff-academy')
        ->assertForbidden();
});

test('staff academy exception chart counts a settled absence', function (): void {
    Carbon::setTestNow('2026-07-07 17:15:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $employee = Employee::factory()->create(['status' => 'active']);

    Attendance::factory()->absent()->create([
        'employee_id' => $employee->id,
        'date' => '2026-07-07',
    ]);

    $this->getJson('/api/v1/reports/staff-academy?from=2026-07-01&to=2026-07-31')
        ->assertOk()
        ->assertJsonPath('data.attendance_exceptions.0.label', 'Absence')
        ->assertJsonPath('data.attendance_exceptions.0.reviewed', 1);
});

test('staff academy coach performance excludes non coach employees', function (): void {
    Carbon::setTestNow('2026-07-07 17:15:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $coach = Employee::factory()->create([
        'name' => 'Coach Lina',
        'role' => 'coach',
        'status' => 'active',
    ]);
    $employee = Employee::factory()->create([
        'name' => 'Desk Dina',
        'role' => 'employee',
        'status' => 'active',
    ]);

    Commission::factory()->create([
        'employee_id' => $coach->id,
        'amount' => '100.00',
        'created_at' => '2026-07-07 10:00:00',
    ]);
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '1000.00',
        'created_at' => '2026-07-07 10:00:00',
    ]);

    $response = $this->getJson('/api/v1/reports/staff-academy?from=2026-07-01&to=2026-07-31')
        ->assertOk();

    expect(collect($response->json('data.performance_highlights'))->pluck('name')->all())
        ->toContain('Coach Lina')
        ->not->toContain('Desk Dina');
});
