<?php

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\OvertimeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

function actingAsOvertimeManager(): User
{
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    return $manager;
}

test('uncovered shifts list employees who were scheduled but never checked in', function (): void {
    actingAsOvertimeManager();

    $shift = EmployeeShift::factory()->create([
        'name' => 'Morning',
        'starts_at' => '08:00:00',
        'ends_at' => '16:00:00',
        'off_days' => [],
    ]);

    $absent = Employee::factory()->create(['name' => 'Absent Amir', 'shift_id' => $shift->id, 'status' => 'active']);
    $present = Employee::factory()->create(['name' => 'Present Pola', 'shift_id' => $shift->id, 'status' => 'active']);

    Attendance::factory()->create([
        'employee_id' => $present->id,
        'shift_id' => $shift->id,
        'date' => today()->toDateString(),
        'check_in' => '08:05',
    ]);

    $this->getJson('/api/v1/overtime-shifts/candidates?date='.today()->toDateString())
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.employee.id', $absent->id)
        ->assertJsonPath('data.0.shift.name', 'Morning')
        ->assertJsonPath('data.0.covered_by', null);
});

test('an employee can pick up the shift of an absent colleague', function (): void {
    actingAsOvertimeManager();

    $shift = EmployeeShift::factory()->create([
        'starts_at' => '08:00:00',
        'ends_at' => '16:00:00',
        'off_days' => [],
    ]);
    $absent = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    $cover = Employee::factory()->create(['name' => 'Cover Karim', 'status' => 'active']);

    $this->postJson('/api/v1/overtime-shifts', [
        'employee_id' => $cover->id,
        'covering_for_employee_id' => $absent->id,
        'date' => today()->toDateString(),
        'notes' => 'Covering the morning desk.',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.employee_shift_id', $shift->id)
        ->assertJsonPath('data.starts_at', '08:00')
        ->assertJsonPath('data.ends_at', '16:00')
        ->assertJsonPath('data.hours', '8.00')
        // Amount is typed in by an admin later, never derived here.
        ->assertJsonPath('data.bonus_amount', '0.00');

    $this->getJson('/api/v1/overtime-shifts/candidates?date='.today()->toDateString())
        ->assertOk()
        ->assertJsonPath('data.0.covered_by.employee_id', $cover->id);
});

test('an admin can manually assign a replacement for someone auto-detection never surfaces', function (): void {
    actingAsOvertimeManager();

    // Off-day employees are filtered out of the uncovered-shift list, so this pairing
    // can only be created by hand.
    $shift = EmployeeShift::factory()->create([
        'name' => 'Evening',
        'starts_at' => '16:00:00',
        'ends_at' => '21:00:00',
        'off_days' => [(int) today()->dayOfWeek],
    ]);
    $replaced = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    $replacement = Employee::factory()->create(['name' => 'Standby Sami', 'status' => 'active']);

    $this->getJson('/api/v1/overtime-shifts/candidates?date='.today()->toDateString())
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->postJson('/api/v1/overtime-shifts', [
        'employee_id' => $replacement->id,
        'covering_for_employee_id' => $replaced->id,
        'employee_shift_id' => $shift->id,
        'date' => today()->toDateString(),
        'notes' => 'Manual swap agreed with the manager.',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.employee_id', $replacement->id)
        ->assertJsonPath('data.covering_for_employee_id', $replaced->id)
        ->assertJsonPath('data.employee_shift_id', $shift->id)
        ->assertJsonPath('data.bonus_amount', '0.00');
});

test('overtime cannot be claimed for a colleague who did attend', function (): void {
    actingAsOvertimeManager();

    $shift = EmployeeShift::factory()->create(['off_days' => []]);
    $attended = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    $cover = Employee::factory()->create(['status' => 'active']);

    Attendance::factory()->create([
        'employee_id' => $attended->id,
        'date' => today()->toDateString(),
        'check_in' => '08:00',
    ]);

    $this->postJson('/api/v1/overtime-shifts', [
        'employee_id' => $cover->id,
        'covering_for_employee_id' => $attended->id,
        'date' => today()->toDateString(),
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['covering_for_employee_id']]]);
});

test('the same absent colleague cannot be covered twice', function (): void {
    actingAsOvertimeManager();

    $shift = EmployeeShift::factory()->create(['off_days' => []]);
    $absent = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    $first = Employee::factory()->create(['status' => 'active']);
    $second = Employee::factory()->create(['status' => 'active']);

    $payload = [
        'covering_for_employee_id' => $absent->id,
        'date' => today()->toDateString(),
    ];

    $this->postJson('/api/v1/overtime-shifts', $payload + ['employee_id' => $first->id])
        ->assertStatus(201);

    $this->postJson('/api/v1/overtime-shifts', $payload + ['employee_id' => $second->id])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['covering_for_employee_id']]]);
});

test('approving an overtime shift requires a hand entered bonus amount', function (): void {
    actingAsOvertimeManager();

    $overtime = OvertimeShift::query()->create([
        'employee_id' => Employee::factory()->create()->id,
        'date' => today()->toDateString(),
        'status' => OvertimeShift::STATUS_PENDING,
        'bonus_amount' => '0.00',
    ]);

    $this->putJson("/api/v1/overtime-shifts/{$overtime->id}", ['decision' => 'approved'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['bonus_amount']]]);

    $this->putJson("/api/v1/overtime-shifts/{$overtime->id}", [
        'decision' => 'approved',
        'bonus_amount' => '250',
        'notes' => 'Covered a full extra shift.',
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'approved')
        ->assertJsonPath('data.bonus_amount', '250.00');
});

test('an approved overtime shift can be settled once the bonus is added to the salary', function (): void {
    actingAsOvertimeManager();

    $overtime = OvertimeShift::query()->create([
        'employee_id' => Employee::factory()->create()->id,
        'date' => today()->toDateString(),
        'status' => OvertimeShift::STATUS_PENDING,
        'bonus_amount' => '0.00',
    ]);

    $this->putJson("/api/v1/overtime-shifts/{$overtime->id}", ['decision' => 'settled'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['decision']]]);

    $this->putJson("/api/v1/overtime-shifts/{$overtime->id}", [
        'decision' => 'approved',
        'bonus_amount' => '180.00',
    ])->assertOk();

    $this->putJson("/api/v1/overtime-shifts/{$overtime->id}", ['decision' => 'settled'])
        ->assertOk()
        ->assertJsonPath('data.status', 'settled');

    expect(OvertimeShift::find($overtime->id)->settled_at)->not->toBeNull();
});

test('overtime summary totals approved and settled bonuses per employee for a month', function (): void {
    actingAsOvertimeManager();

    $employee = Employee::factory()->create(['name' => 'Cover Karim']);

    OvertimeShift::query()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-10',
        'hours' => '8.00',
        'bonus_amount' => '200.00',
        'status' => OvertimeShift::STATUS_APPROVED,
    ]);
    OvertimeShift::query()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-11',
        'hours' => '4.00',
        'bonus_amount' => '100.00',
        'status' => OvertimeShift::STATUS_SETTLED,
    ]);
    OvertimeShift::query()->create([
        'employee_id' => $employee->id,
        'date' => '2026-07-01',
        'hours' => '4.00',
        'bonus_amount' => '999.00',
        'status' => OvertimeShift::STATUS_APPROVED,
    ]);

    $this->getJson('/api/v1/overtime-shifts/summary?month=2026-06')
        ->assertOk()
        ->assertJsonPath('data.0.employee_id', $employee->id)
        ->assertJsonPath('data.0.approved_amount', '200.00')
        ->assertJsonPath('data.0.settled_amount', '100.00');
});

test('overtime endpoints reject users without attendance permissions', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/overtime-shifts')->assertStatus(403);
    $this->postJson('/api/v1/overtime-shifts', [
        'employee_id' => Employee::factory()->create()->id,
        'date' => today()->toDateString(),
    ])->assertStatus(403);
});

test('overtime endpoints require authentication', function (): void {
    $this->getJson('/api/v1/overtime-shifts')->assertStatus(401);
});
