<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Payment;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
    Notification::fake();
});

/** A desk employee: can run a shift, is not an admin. */
function deskStaff(EmployeeShift $shift, string $name): array
{
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    $employee = Employee::factory()->create([
        'user_id' => $user->id,
        'shift_id' => $shift->id,
        'name' => $name,
        'status' => 'active',
    ]);

    return [$user, $employee];
}

/** The shift the previous employee left behind: closed, counted, with cash in the drawer. */
function previousShift(EmployeeShift $shift, User $user, Employee $employee, string $cash = '5000.00'): ShiftSession
{
    return ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHours(8),
        'closed_at' => now()->subHour(),
        'opened_by' => $user->id,
        'opened_by_employee_id' => $employee->id,
        'closed_by' => $user->id,
        'closed_by_employee_id' => $employee->id,
        'status' => ShiftSession::STATUS_ACCEPTED,
        'opening_float' => '0.00',
        'expected_cash' => $cash,
        'counted_cash' => $cash,
    ]);
}

test('the next employee is not shown the drawer they inherited', function (): void {
    $shift = EmployeeShift::factory()->create();
    [$goneHome, $goneHomeEmployee] = deskStaff($shift, 'Morning Staff');
    [$onDuty, $onDutyEmployee] = deskStaff($shift, 'Evening Staff');

    previousShift($shift, $goneHome, $goneHomeEmployee, '5000.00');

    Sanctum::actingAs($onDuty);
    $opened = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'employee_id' => $onDutyEmployee->id,
    ])->assertStatus(201);

    // The cash is really there — it stays in the drawer — but it is the previous
    // employee's account of it, so none of it reaches this one's screen.
    expect(ShiftSession::query()->find($opened->json('data.id'))->opening_float)->toBe('5000.00');

    $opened
        ->assertJsonPath('data.opening_float', null)
        ->assertJsonPath('data.previous_session_id', null)
        ->assertJsonPath('data.expected_cash', null)
        ->assertJsonPath('data.money_scope', 'own')
        ->assertJsonPath('data.live_totals.opening_float', null);
});

test('the live cash figure counts only what this employee took in', function (): void {
    $shift = EmployeeShift::factory()->create();
    [$goneHome, $goneHomeEmployee] = deskStaff($shift, 'Morning Staff');
    [$onDuty, $onDutyEmployee] = deskStaff($shift, 'Evening Staff');

    previousShift($shift, $goneHome, $goneHomeEmployee, '5000.00');

    Sanctum::actingAs($onDuty);
    $sessionId = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'employee_id' => $onDutyEmployee->id,
    ])->json('data.id');

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => Subscription::factory()->create()->id,
        'amount' => '300.00',
        'method' => 'cash',
        'status' => Payment::COLLECTED_STATUSES[0],
        'shift_session_id' => $sessionId,
        'paid_at' => now(),
    ]);

    // 300 collected, not 5300: the float is in the drawer but not on their account.
    $this->getJson('/api/v1/shift-sessions/current')
        ->assertOk()
        ->assertJsonPath('data.live_totals.cash', '300.00')
        ->assertJsonPath('data.live_totals.net', '300.00')
        ->assertJsonPath('data.live_totals.opening_float', null);
});

test('an admin still sees the whole drawer', function (): void {
    $shift = EmployeeShift::factory()->create();
    [$goneHome, $goneHomeEmployee] = deskStaff($shift, 'Morning Staff');
    [, $onDutyEmployee] = deskStaff($shift, 'Evening Staff');

    previousShift($shift, $goneHome, $goneHomeEmployee, '5000.00');

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'employee_id' => $onDutyEmployee->id,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.money_scope', 'full')
        ->assertJsonPath('data.opening_float', '5000.00')
        ->assertJsonPath('data.live_totals.opening_float', '5000.00')
        ->assertJsonPath('data.live_totals.cash', '5000.00');
});

test('shift history is an admin list, not a staff one', function (): void {
    $shift = EmployeeShift::factory()->create();
    [$goneHome, $goneHomeEmployee] = deskStaff($shift, 'Morning Staff');
    [$onDuty, $onDutyEmployee] = deskStaff($shift, 'Evening Staff');

    $previous = previousShift($shift, $goneHome, $goneHomeEmployee, '5000.00');

    Sanctum::actingAs($onDuty);
    $mine = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'employee_id' => $onDutyEmployee->id,
    ])->json('data.id');

    $listed = collect($this->getJson('/api/v1/shift-sessions')->assertOk()->json('data'))->pluck('id');

    expect($listed->all())->toBe([$mine])
        ->and($listed)->not->toContain($previous->id);
});

test('an employee cannot read another open shift by asking for the list', function (): void {
    $shift = EmployeeShift::factory()->create();
    [$working, $workingEmployee] = deskStaff($shift, 'Working Staff');
    [$idle] = deskStaff($shift, 'Off Duty Staff');

    Sanctum::actingAs($working);
    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'employee_id' => $workingEmployee->id,
    ])->assertStatus(201);

    Sanctum::actingAs($idle);

    expect($this->getJson('/api/v1/shift-sessions')->assertOk()->json('data'))->toBe([]);

    // The desk still has to say a shift is open, or a second one gets started on
    // top of it — but it says so without any of the money.
    $this->getJson('/api/v1/shift-sessions/current')
        ->assertOk()
        ->assertJsonPath('data.money_scope', 'none')
        ->assertJsonPath('data.staff_on_duty.name', 'Working Staff')
        ->assertJsonPath('data.opening_float', null)
        ->assertJsonPath('data.expected_card', null)
        ->assertJsonPath('data.live_totals', [])
        ->assertJsonPath('data.variance', []);
});
