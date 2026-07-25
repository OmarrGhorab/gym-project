<?php

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('manager can list attendance filtered by employee and date range', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $employee = Employee::factory()->create();
    Attendance::factory()->create(['employee_id' => $employee->id, 'date' => '2026-06-10']);
    Attendance::factory()->create(['employee_id' => $employee->id, 'date' => '2026-06-20']);
    Attendance::factory()->create(['date' => '2026-06-15']);

    $this->getJson("/api/v1/attendance?filter[employee_id]={$employee->id}&filter[from]=2026-06-01&filter[to]=2026-06-15")
        ->assertStatus(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.date', '2026-06-10');
});

test('manager can view monthly attendance summary per employee', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $employee = Employee::factory()->create(['name' => 'Mona Ahmed', 'role' => 'manager']);
    Attendance::factory()->create(['employee_id' => $employee->id, 'date' => '2026-06-10', 'status' => 'present']);
    Attendance::factory()->create(['employee_id' => $employee->id, 'date' => '2026-06-11', 'status' => 'late']);
    Attendance::factory()->create(['employee_id' => $employee->id, 'date' => '2026-07-01', 'status' => 'absent']);

    $this->getJson('/api/v1/attendance/summary?month=2026-06')
        ->assertOk()
        ->assertJsonPath('data.0.employee_id', $employee->id)
        ->assertJsonPath('data.0.name', 'Mona Ahmed')
        ->assertJsonPath('data.0.records_count', 2)
        ->assertJsonPath('data.0.present_count', 2)
        ->assertJsonPath('data.0.late_count', 1);
});

test('manager can create update and delete attendance', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $employee = Employee::factory()->create(['name' => 'Nour Salem']);

    $response = $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'date' => '2026-06-26',
        'check_in' => '09:15',
        'check_out' => '17:30',
        'status' => 'late',
        'notes' => 'Traffic delay',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.employee.name', 'Nour Salem')
        ->assertJsonPath('data.status', 'late')
        ->assertJsonPath('data.check_in', '09:15');

    $attendanceId = $response->json('data.id');

    $this->putJson("/api/v1/attendance/{$attendanceId}", [
        'employee_id' => $employee->id,
        'date' => '2026-06-26',
        'check_in' => '09:00',
        'check_out' => '17:00',
        'status' => 'present',
        'notes' => null,
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'present')
        ->assertJsonPath('data.check_out', '17:00');

    $this->deleteJson("/api/v1/attendance/{$attendanceId}")
        ->assertStatus(204);

    expect(Attendance::find($attendanceId))->toBeNull();
});

test('attendance rejects duplicate employee date rows', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $employee = Employee::factory()->create();
    Attendance::factory()->create(['employee_id' => $employee->id, 'date' => '2026-06-26']);

    $this->postJson('/api/v1/attendance', [
        'employee_id' => $employee->id,
        'date' => '2026-06-26',
        'status' => 'present',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['date']]]);
});

test('users without attendance permission cannot list attendance', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/attendance')
        ->assertForbidden();
});

test('attendance users can fetch active employee options', function (): void {
    $cashier = User::factory()->create();
    $cashier->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($cashier);

    Employee::factory()->create(['name' => 'Active Staff Option', 'status' => 'active']);
    Employee::factory()->create(['name' => 'Inactive Staff Option', 'status' => 'inactive']);

    $response = $this->getJson('/api/v1/attendance/employee-options?filter[status]=active&per_page=100')
        ->assertOk()
        ->assertJsonCount(1, 'data');

    expect($response->json('data.0.name'))->toBe('Active Staff Option');
});
