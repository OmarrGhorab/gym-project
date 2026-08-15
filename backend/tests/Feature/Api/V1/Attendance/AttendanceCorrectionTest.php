<?php

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);

    $this->admin = User::factory()->create();
    $this->admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($this->admin);
});

function workingShift(array $overrides = []): EmployeeShift
{
    return EmployeeShift::factory()->create(array_merge(['name' => 'Morning'], $overrides));
}

/*
|--------------------------------------------------------------------------
| Admin correcting attendance for staff who forgot to scan
|--------------------------------------------------------------------------
*/

test('an admin can record a day the scanner missed', function (): void {
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
        ->assertJsonPath('data.shift.name', 'Morning');

    $this->getJson('/api/v1/attendance/'.$created->json('data.id'))
        ->assertOk()
        ->assertJsonPath('data.check_in', '09:00');
});

test('an arrival at any hour is simply recorded, never judged', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    // Well outside anything that used to count as on time.
    $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '13:45',
        'status' => 'present',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.check_in', '13:45')
        ->assertJsonPath('data.status', 'present')
        ->assertJsonMissingPath('data.late_minutes')
        ->assertJsonMissingPath('data.schedule_status');
});

test('an admin can correct the clock times on an existing record', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $attendance = Attendance::factory()->create([
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '10:00',
        'check_out' => null,
        'status' => 'present',
    ]);

    $this->putJson("/api/v1/attendance/{$attendance->id}", [
        'check_in' => '09:05',
        'check_out' => '16:00',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.check_in', '09:05')
        ->assertJsonPath('data.check_out', '16:00');
});

test('no role but admin may write attendance by hand', function (string $role): void {
    // The desk scans people in all day (attendance.create) but must not be able
    // to author a day nobody scanned, rewrite one that was, or throw one away.
    $user = User::factory()->create();
    $user->assignRole($role);
    Sanctum::actingAs($user);

    $employee = Employee::factory()->create(['status' => 'active']);
    $existing = Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-07-19',
    ]);

    $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'date' => '2026-07-20',
        'check_in' => '09:00',
        'status' => 'present',
    ])->assertForbidden();

    $this->putJson("/api/v1/attendance/{$existing->id}", [
        'check_in' => '09:05',
    ])->assertForbidden();

    $this->deleteJson("/api/v1/attendance/{$existing->id}")->assertForbidden();

    expect(Attendance::query()->where('date', '2026-07-20')->exists())->toBeFalse();
    expect(Attendance::find($existing->id))->not->toBeNull();
})->with([
    FoundationPermissions::ROLE_MANAGER,
    FoundationPermissions::ROLE_CASHIER,
    FoundationPermissions::ROLE_CAPTAIN,
    FoundationPermissions::ROLE_ACCOUNTANT,
]);

test('a role created after the presets loses attendance corrections when the migration runs', function (): void {
    // Production runs Admin plus a reception role that no seeder knows about.
    $reception = Role::create(['name' => 'Reception', 'guard_name' => 'web']);
    $reception->givePermissionTo(['attendance.view', 'attendance.create', 'attendance.update', 'attendance.delete']);

    $migration = require database_path('migrations/2026_08_15_120000_restrict_attendance_corrections_to_admin.php');
    $migration->up();

    $user = User::factory()->create();
    $user->assignRole($reception);
    Sanctum::actingAs($user);

    $employee = Employee::factory()->create(['status' => 'active']);

    $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'date' => '2026-07-20',
        'check_in' => '09:00',
        'status' => 'present',
    ])->assertForbidden();

    expect($user->fresh()->can('attendance.create'))->toBeTrue();
});

test('recording a second row for the same employee and day is rejected', function (): void {
    $shift = workingShift();
    $employee = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
    ]);

    $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '09:00',
        'status' => 'present',
    ])->assertStatus(422);
});
