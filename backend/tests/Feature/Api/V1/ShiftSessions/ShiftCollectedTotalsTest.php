<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\ShiftSession;
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

/**
 * A closed shift that opened on a float and took money in on top of it.
 *
 * The drawer ends at 5,000 but only 3,000 of that was earned here — the shape
 * that made "expected cash" a misleading measure of how a shift did.
 */
function closedShiftWithFloat(): ShiftSession
{
    $shift = EmployeeShift::factory()->create();
    $user = User::factory()->create();
    $employee = Employee::factory()->create([
        'user_id' => $user->id,
        'shift_id' => $shift->id,
        'status' => 'active',
    ]);

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
        'opening_float' => '2000.00',
        'expected_cash' => '5000.00',
        'expected_card' => '750.00',
        'expected_bank' => '250.00',
        'counted_cash' => '5000.00',
    ]);
}

function actAsAdmin(): void
{
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
}

test('an admin sees what the shift took, with the inherited float taken back out', function (): void {
    $session = closedShiftWithFloat();
    actAsAdmin();

    test()->getJson('/api/v1/shift-sessions?per_page=50')
        ->assertStatus(200)
        ->assertJsonPath('data.0.opening_float', '2000.00')
        ->assertJsonPath('data.0.expected_cash', '5000.00')
        // 5000 in the drawer less the 2000 it opened on.
        ->assertJsonPath('data.0.collected_cash', '3000.00')
        // Plus the card and bank taken on the same shift.
        ->assertJsonPath('data.0.collected_total', '4000.00');

    expect($session->fresh()->expected_cash)->toBe('5000.00');
});

test('a shift that opened on an empty drawer collects its whole expected cash', function (): void {
    $shift = EmployeeShift::factory()->create();
    ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHours(4),
        'closed_at' => now()->subHour(),
        'status' => ShiftSession::STATUS_ACCEPTED,
        'opening_float' => '0.00',
        'expected_cash' => '1200.00',
        'expected_card' => '0.00',
        'expected_bank' => '0.00',
    ]);
    actAsAdmin();

    test()->getJson('/api/v1/shift-sessions?per_page=50')
        ->assertStatus(200)
        ->assertJsonPath('data.0.collected_cash', '1200.00')
        ->assertJsonPath('data.0.collected_total', '1200.00');
});

test('a shift still open reports no collected figure, because the drawer is not counted yet', function (): void {
    $shift = EmployeeShift::factory()->create();
    ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHour(),
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '2000.00',
    ]);
    actAsAdmin();

    test()->getJson('/api/v1/shift-sessions?per_page=50')
        ->assertStatus(200)
        ->assertJsonPath('data.0.collected_cash', null)
        ->assertJsonPath('data.0.collected_total', null);
});

test('the collected figures never reach someone who may not see the drawer', function (): void {
    $session = closedShiftWithFloat();

    $outsider = User::factory()->create();
    $outsider->assignRole(FoundationPermissions::ROLE_CASHIER);
    Employee::factory()->create(['user_id' => $outsider->id, 'status' => 'active']);
    Sanctum::actingAs($outsider);

    // These are derived from the float, so they inherit its privacy. In practice
    // the guard bites earlier still: somebody else's closed shift is not theirs
    // to open at all, and the list they can ask for holds only their own.
    test()->getJson("/api/v1/shift-sessions/{$session->id}")->assertStatus(404);

    $listed = test()->getJson('/api/v1/shift-sessions?per_page=50')
        ->assertStatus(200)
        ->json('data');

    expect(collect($listed)->pluck('id'))->not->toContain($session->id);
});
