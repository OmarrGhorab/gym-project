<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\OvertimeShift;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow();
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

afterEach(function (): void {
    Carbon::setTestNow();
});

/** Sessions may only be held by an employee of the shift, so link the acting user to one. */
function shiftStaff(User $user, EmployeeShift $shift, string $name = 'Shift Staff'): Employee
{
    return Employee::factory()->create([
        'user_id' => $user->id,
        'shift_id' => $shift->id,
        'name' => $name,
        'status' => 'active',
    ]);
}

test('a dated cover employee appears in the shift desk and can hold that covered shift', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $coveredShift = EmployeeShift::factory()->create(['name' => 'Morning']);
    $homeShift = EmployeeShift::factory()->create(['name' => 'Evening']);
    $coveringEmployee = Employee::factory()->create([
        'shift_id' => $homeShift->id,
        'status' => 'active',
        'name' => 'Covering Employee',
    ]);

    OvertimeShift::query()->create([
        'employee_id' => $coveringEmployee->id,
        'employee_shift_id' => $coveredShift->id,
        'date' => now()->toDateString(),
        'status' => OvertimeShift::STATUS_PENDING,
    ]);

    $this->getJson('/api/v1/shift-sessions/options')
        ->assertOk()
        ->assertJsonFragment([
            'id' => $coveringEmployee->id,
            'name' => 'Covering Employee',
        ]);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $coveredShift->id,
        'employee_id' => $coveringEmployee->id,
        'force_open' => true,
    ])
        ->assertCreated()
        ->assertJsonPath('data.staff_on_duty.name', 'Covering Employee');
});

test('shift desk does not duplicate the signed-in employee already represented by me', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $shift = EmployeeShift::factory()->create();
    shiftStaff($user, $shift, 'Signed In Staff');

    $this->getJson('/api/v1/shift-sessions/options')
        ->assertOk()
        ->assertJsonMissing(['name' => 'Signed In Staff']);
});

test('staff can open close and submit matching handover for admin review', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $shift = EmployeeShift::factory()->create([
        'starts_at' => '06:00:00',
        'ends_at' => '11:00:00',
    ]);
    $employee = shiftStaff($user, $shift, 'Nour Morning');

    $open = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'opening_float' => '100.00',
        'force_open' => true,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.staff_on_duty.name', 'Nour Morning');

    $sessionId = $open->json('data.id');

    $subscription = Subscription::factory()->active()->create(['price_paid' => '50.00']);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '50.00',
        'method' => 'cash',
        'status' => 'paid',
        'shift_session_id' => $sessionId,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '20.00',
        'method' => 'card',
        'status' => 'paid',
        'shift_session_id' => $sessionId,
    ]);
    Expense::factory()->create([
        'amount' => '10.00',
        'shift_session_id' => $sessionId,
        'created_by' => $user->id,
    ]);

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/close")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'pending_handover')
        ->assertJsonPath('data.expected_cash', '150.00')
        ->assertJsonPath('data.expected_card', '20.00')
        ->assertJsonPath('data.expected_expenses', '10.00');

    expect(ShiftSession::find($sessionId)->closed_by_employee_id)->toBe($employee->id);

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/handover", [
        'counted_cash' => '150.00',
        'counted_card' => '20.00',
        'counted_bank' => '0.00',
        'counted_expenses' => '10.00',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'pending_admin');

    $review = $this->postJson("/api/v1/shift-sessions/{$sessionId}/review", [
        'decision' => 'accepted',
    ])->assertStatus(200);

    expect($review->json('data.status'))->toBe(ShiftSession::STATUS_ACCEPTED);
});

test('an admin can hand an open session to another employee of the same shift', function (): void {
    $admin = User::factory()->create(['name' => 'Admin User']);
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();
    $opener = shiftStaff($admin, $shift, 'Nour Morning');
    $successor = Employee::factory()->create([
        'shift_id' => $shift->id,
        'name' => 'Hana Morning',
        'status' => 'active',
    ]);

    $open = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'force_open' => true,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.staff_on_duty.name', 'Nour Morning');

    $sessionId = $open->json('data.id');

    $this->putJson("/api/v1/shift-sessions/{$sessionId}/staff", ['employee_id' => $successor->id])
        ->assertStatus(200)
        ->assertJsonPath('data.staff_on_duty.name', 'Hana Morning');

    $session = ShiftSession::find($sessionId);
    expect($session->opened_by_employee_id)->toBe($successor->id)
        // Reassigning changes accountability only — the money is untouched.
        ->and($session->opening_float)->toBe($open->json('data.opening_float'))
        ->and($opener->id)->not->toBe($successor->id)
        ->and(OvertimeShift::query()
            ->where('employee_id', $successor->id)
            ->where('covering_for_employee_id', $opener->id)
            ->where('employee_shift_id', $shift->id)
            ->where('status', OvertimeShift::STATUS_PENDING)
            ->exists())->toBeTrue();
});

test('staff on duty can be handed to an active employee from another shift', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();
    shiftStaff($admin, $shift);
    $outsider = Employee::factory()->create([
        'shift_id' => EmployeeShift::factory()->create()->id,
        'status' => 'active',
    ]);

    $sessionId = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'force_open' => true,
    ])->assertStatus(201)->json('data.id');

    $this->putJson("/api/v1/shift-sessions/{$sessionId}/staff", ['employee_id' => $outsider->id])
        ->assertStatus(200)
        ->assertJsonPath('data.staff_on_duty.id', $outsider->id);

    expect(OvertimeShift::query()
        ->where('employee_id', $outsider->id)
        ->where('employee_shift_id', $shift->id)
        ->whereDate('date', now()->toDateString())
        ->where('status', OvertimeShift::STATUS_PENDING)
        ->exists())->toBeTrue();

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/close")
        ->assertOk()
        ->assertJsonPath('data.status', ShiftSession::STATUS_PENDING_HANDOVER)
        ->assertJsonPath('data.closed_by_employee.id', $outsider->id);
});

test('assigning an employee to an unstaffed session creates overtime coverage and permits closing', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();
    $outsider = Employee::factory()->create([
        'shift_id' => EmployeeShift::factory()->create()->id,
        'status' => 'active',
    ]);
    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'status' => ShiftSession::STATUS_OPEN,
        'opened_at' => now()->subHour(),
        'opened_by' => $admin->id,
        'opened_by_employee_id' => null,
        'opening_float' => '0.00',
    ]);

    $this->putJson("/api/v1/shift-sessions/{$session->id}/staff", ['employee_id' => $outsider->id])
        ->assertOk()
        ->assertJsonPath('data.staff_on_duty.id', $outsider->id);

    expect(OvertimeShift::query()
        ->where('employee_id', $outsider->id)
        ->where('employee_shift_id', $shift->id)
        ->whereNull('covering_for_employee_id')
        ->where('status', OvertimeShift::STATUS_PENDING)
        ->exists())->toBeTrue();

    $this->postJson("/api/v1/shift-sessions/{$session->id}/close")
        ->assertOk()
        ->assertJsonPath('data.status', ShiftSession::STATUS_PENDING_HANDOVER)
        ->assertJsonPath('data.closed_by_employee.id', $outsider->id);
});

test('staff on duty cannot be changed once the session is closed', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();
    shiftStaff($admin, $shift);
    $successor = Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $sessionId = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'force_open' => true,
    ])->assertStatus(201)->json('data.id');

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/close")->assertStatus(200);

    $this->putJson("/api/v1/shift-sessions/{$sessionId}/staff", ['employee_id' => $successor->id])
        ->assertStatus(422);
});

test('a session cannot be opened by someone who is not on that shift', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $shift = EmployeeShift::factory()->create();
    $otherShift = EmployeeShift::factory()->create();
    shiftStaff($user, $otherShift, 'Wrong Shift Waleed');

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'opening_float' => '0.00',
        'force_open' => true,
    ])->assertStatus(422);

    expect(ShiftSession::query()->count())->toBe(0);
});

test('an admin opening on behalf of staff records the employee not the admin', function (): void {
    $admin = User::factory()->create(['name' => 'Admin User']);
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();
    $onDuty = Employee::factory()->create([
        'shift_id' => $shift->id,
        'name' => 'Hana Morning',
        'status' => 'active',
    ]);

    $response = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'employee_id' => $onDuty->id,
        'force_open' => true,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.staff_on_duty.name', 'Hana Morning')
        ->assertJsonPath('data.opened_by.name', 'Admin User');

    expect(ShiftSession::find($response->json('data.id'))->opened_by_employee_id)->toBe($onDuty->id);
});

test('an admin can hand a shift to an active employee from a different shift', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();
    $otherShift = EmployeeShift::factory()->create();
    $outsider = Employee::factory()->create(['shift_id' => $otherShift->id, 'status' => 'active']);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'employee_id' => $outsider->id,
        'force_open' => true,
    ])->assertStatus(201)
        ->assertJsonPath('data.staff_on_duty.id', $outsider->id);
});

test('an admin with no employee on the shift must name who is on duty', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'force_open' => true,
    ])->assertStatus(422);
});

test('the current session endpoint never creates a session implicitly', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    EmployeeShift::factory()->create();

    $this->getJson('/api/v1/shift-sessions/current')
        ->assertStatus(200)
        ->assertJsonPath('data', null);

    expect(ShiftSession::query()->count())->toBe(0);
});

test('admins are notified when a shift session is opened and closed', function (): void {
    Notification::fake();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create();
    shiftStaff($admin, $shift, 'Yara Morning');

    $open = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'opening_float' => '50.00',
        'force_open' => true,
    ])->assertStatus(201);

    Notification::assertSentTo(
        $admin,
        OperationalNotification::class,
        fn ($notification) => ($notification->toArray($admin)['category'] ?? null) === 'shifts.session_opened'
    );

    $this->postJson("/api/v1/shift-sessions/{$open->json('data.id')}/close")->assertStatus(200);

    Notification::assertSentTo(
        $admin,
        OperationalNotification::class,
        fn ($notification) => ($notification->toArray($admin)['category'] ?? null) === 'shifts.session_closed'
    );
});

test('cash carries forward between shifts on the same business day', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $morning = EmployeeShift::factory()->create(['name' => 'Morning']);
    $midday = EmployeeShift::factory()->create(['name' => 'Midday']);
    shiftStaff($user, $midday, 'Karim Midday');

    ShiftSession::query()->create([
        'employee_shift_id' => $morning->id,
        'business_date' => '2026-07-22',
        'status' => ShiftSession::STATUS_ACCEPTED,
        'opened_at' => now()->subHours(6),
        'opened_by' => $user->id,
        'opening_float' => '100.00',
        'counted_cash' => '500.00',
        'expected_cash' => '500.00',
        'closed_at' => now()->subHours(2),
        'closed_by' => $user->id,
    ]);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $midday->id,
        'business_date' => '2026-07-22',
        'force_open' => true,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.opening_float', '500.00');
});

test('same day handover cannot be overridden with a manual opening float', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $morning = EmployeeShift::factory()->create(['name' => 'Morning']);
    $midday = EmployeeShift::factory()->create(['name' => 'Midday']);
    shiftStaff($user, $midday, 'Karim Midday');

    ShiftSession::query()->create([
        'employee_shift_id' => $morning->id,
        'business_date' => '2026-07-22',
        'status' => ShiftSession::STATUS_ACCEPTED,
        'opened_at' => now()->subHours(6),
        'opened_by' => $user->id,
        'opening_float' => '100.00',
        'counted_cash' => '500.00',
        'expected_cash' => '500.00',
        'closed_at' => now()->subHours(2),
        'closed_by' => $user->id,
    ]);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $midday->id,
        'business_date' => '2026-07-22',
        'opening_float' => '0.00',
        'force_open' => true,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.opening_float', '500.00');
});

test('new business date automatically resets starting cash float to 0', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $shift = EmployeeShift::factory()->create();
    shiftStaff($user, $shift);

    ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => '2026-07-22',
        'status' => ShiftSession::STATUS_ACCEPTED,
        'opened_at' => now()->subDays(2),
        'opened_by' => $user->id,
        'opening_float' => '100.00',
        'counted_cash' => '500.00',
        'expected_cash' => '500.00',
        'closed_at' => now()->subDay(),
        'closed_by' => $user->id,
    ]);

    $openDay2 = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'business_date' => '2026-07-23',
        'force_open' => true,
    ])->assertStatus(201);

    expect($openDay2->json('data.opening_float'))->toBe('0.00');
});

test('auto accept setting accepts an intermediate matching handover without admin', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept'], ['value' => true]);
    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept_on_match_only'], ['value' => true]);

    $shift = EmployeeShift::factory()->create([
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
    ]);
    EmployeeShift::factory()->create([
        'starts_at' => '17:00:00',
        'ends_at' => '00:00:00',
    ]);
    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHours(4),
        'opened_by' => $user->id,
        'status' => ShiftSession::STATUS_PENDING_HANDOVER,
        'opening_float' => '0.00',
        'closed_at' => now(),
        'closed_by' => $user->id,
        'expected_cash' => '30.00',
        'expected_card' => '0.00',
        'expected_bank' => '0.00',
        'expected_expenses' => '0.00',
        'expected_net' => '30.00',
    ]);

    $this->postJson("/api/v1/shift-sessions/{$session->id}/handover", [
        'counted_cash' => '30.00',
        'counted_card' => '0.00',
        'counted_bank' => '0.00',
        'counted_expenses' => '0.00',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'auto_accepted');
});

test('final shift matching handover always waits for admin acceptance', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept'], ['value' => true]);
    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept_on_match_only'], ['value' => true]);

    $closing = EmployeeShift::factory()->create([
        'starts_at' => '21:00:00',
        'ends_at' => '00:00:00',
    ]);
    $session = ShiftSession::query()->create([
        'employee_shift_id' => $closing->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHours(4),
        'opened_by' => $user->id,
        'status' => ShiftSession::STATUS_PENDING_HANDOVER,
        'opening_float' => '0.00',
        'closed_at' => now(),
        'closed_by' => $user->id,
        'expected_cash' => '30.00',
        'expected_card' => '0.00',
        'expected_bank' => '0.00',
        'expected_expenses' => '0.00',
        'expected_net' => '30.00',
    ]);

    $this->postJson("/api/v1/shift-sessions/{$session->id}/handover", [
        'counted_cash' => '30.00',
        'counted_card' => '0.00',
        'counted_bank' => '0.00',
        'counted_expenses' => '0.00',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'pending_admin');
});

test('non assigned employee cannot close shift session', function (): void {
    $shiftOwnerUser = User::factory()->create();
    $otherUser = User::factory()->create();
    $otherUser->assignRole(FoundationPermissions::ROLE_CASHIER);

    $differentShift = EmployeeShift::factory()->create();
    Employee::factory()->create(['user_id' => $otherUser->id, 'shift_id' => $differentShift->id]);

    Sanctum::actingAs($otherUser);

    $shift = EmployeeShift::factory()->create();
    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHours(4),
        'opened_by' => $shiftOwnerUser->id,
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '0.00',
    ]);

    $this->postJson("/api/v1/shift-sessions/{$session->id}/close")
        ->assertStatus(422);
});

test('staff can close shift session before scheduled shift end time', function (): void {
    // Sessions close by hand at checkout, so an early or overtime finish is allowed.
    $shiftUser = User::factory()->create();
    $shiftUser->assignRole(FoundationPermissions::ROLE_CASHIER);

    Sanctum::actingAs($shiftUser);

    $shift = EmployeeShift::factory()->create([
        'starts_at' => '08:00:00',
        'ends_at' => '23:59:00',
    ]);
    shiftStaff($shiftUser, $shift);

    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subMinutes(30),
        'opened_by' => $shiftUser->id,
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '0.00',
    ]);

    $this->postJson("/api/v1/shift-sessions/{$session->id}/close")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'pending_handover');
});

test('staff can close shift session after working past the scheduled end time', function (): void {
    $shiftUser = User::factory()->create();
    $shiftUser->assignRole(FoundationPermissions::ROLE_CASHIER);

    Sanctum::actingAs($shiftUser);

    $shift = EmployeeShift::factory()->create([
        'starts_at' => '00:01:00',
        'ends_at' => '00:02:00',
    ]);
    shiftStaff($shiftUser, $shift);

    $session = ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHours(9),
        'opened_by' => $shiftUser->id,
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '0.00',
    ]);

    $this->postJson("/api/v1/shift-sessions/{$session->id}/close")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'pending_handover');
});

test('require handover blocks opening a new session', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::query()->updateOrCreate(['key' => 'shifts.require_handover_to_open'], ['value' => true]);

    $shiftA = EmployeeShift::factory()->create();
    $shiftB = EmployeeShift::factory()->create();
    shiftStaff($user, $shiftB);

    ShiftSession::query()->create([
        'employee_shift_id' => $shiftA->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHours(6),
        'opened_by' => $user->id,
        'status' => ShiftSession::STATUS_PENDING_HANDOVER,
        'opening_float' => '0.00',
        'closed_at' => now()->subHour(),
        'closed_by' => $user->id,
        'expected_cash' => '10.00',
        'expected_card' => '0.00',
        'expected_bank' => '0.00',
        'expected_expenses' => '0.00',
        'expected_net' => '10.00',
    ]);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shiftB->id,
        'opening_float' => '0.00',
    ])->assertStatus(422);
});

test('manual opening outside the scheduled window requires an explicit force open', function (): void {
    Carbon::setTestNow('2026-07-30 23:00:00');
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $shift = EmployeeShift::factory()->create([
        'name' => 'Morning Desk',
        'starts_at' => '06:00:00',
        'ends_at' => '11:00:00',
        'grace_minutes' => 15,
    ]);
    shiftStaff($admin, $shift);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
    ])
        ->assertUnprocessable()
        ->assertJsonPath('error.details.employee_shift_id.0', 'Morning Desk cannot be opened outside its scheduled time. Use an authorized force-open only for an exceptional situation.');

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'force_open' => true,
    ])->assertCreated();
});

test('non admins cannot force a shift open outside its schedule', function (): void {
    Carbon::setTestNow('2026-07-30 23:00:00');
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $shift = EmployeeShift::factory()->create([
        'starts_at' => '06:00:00',
        'ends_at' => '11:00:00',
    ]);
    shiftStaff($manager, $shift);

    $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'force_open' => true,
    ])
        ->assertUnprocessable()
        ->assertJsonPath('error.details.force_open.0', 'Only an administrator can force a shift open outside its schedule.');
});
