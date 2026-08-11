<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Expense;
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
    // This file is about the count-and-review workflow, which is opt-in: without
    // it, closing a shift finishes the session outright and there is no handover
    // to exercise.
    Setting::query()->create(['key' => 'shifts.require_cash_count', 'value' => true]);
});

afterEach(function (): void {
    Carbon::setTestNow();
});

/** Links the acting user to an employee so the desk has somebody to put on duty. */
function shiftStaff(User $user, EmployeeShift $shift, string $name = 'Shift Staff'): Employee
{
    return Employee::factory()->create([
        'user_id' => $user->id,
        'shift_id' => $shift->id,
        'name' => $name,
        'status' => 'active',
    ]);
}

test('shift desk lists the signed-in employee by name instead of a me option', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $shift = EmployeeShift::factory()->create();
    shiftStaff($user, $shift, 'Signed In Staff');

    // Hiding them behind "Me" showed the user's name while the rules ran against
    // their employee record, so an admin whose employee is on no shift was offered
    // a choice that could only ever fail.
    $this->getJson('/api/v1/shift-sessions/options')
        ->assertOk()
        ->assertJsonFragment(['name' => 'Signed In Staff']);
});

test('staff can open close and submit matching handover for admin review', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $shift = EmployeeShift::factory()->create([
    ]);
    $employee = shiftStaff($user, $shift, 'Nour Morning');

    $open = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'opening_float' => '100.00',
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
        ->and($opener->id)->not->toBe($successor->id);
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
    ])->assertStatus(201)->json('data.id');

    $this->putJson("/api/v1/shift-sessions/{$sessionId}/staff", ['employee_id' => $outsider->id])
        ->assertStatus(200)
        ->assertJsonPath('data.staff_on_duty.id', $outsider->id);

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/close")
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
    ])->assertStatus(201)->json('data.id');

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/close")->assertStatus(200);

    $this->putJson("/api/v1/shift-sessions/{$sessionId}/staff", ['employee_id' => $successor->id])
        ->assertStatus(422);
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
    ])->assertStatus(201);

    expect($openDay2->json('data.opening_float'))->toBe('0.00');
});

test('auto accept setting accepts an intermediate matching handover without admin', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept'], ['value' => true]);
    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept_on_match_only'], ['value' => true]);

    $shift = EmployeeShift::factory()->create(['name' => 'Morning']);
    $laterShift = EmployeeShift::factory()->create(['name' => 'Evening']);
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
    // A later desk on the same day is what makes this one intermediate — the last
    // drawer of the day always waits for an admin.
    ShiftSession::query()->create([
        'employee_shift_id' => $laterShift->id,
        'business_date' => now()->toDateString(),
        'opened_at' => now()->subHour(),
        'opened_by' => $user->id,
        'status' => ShiftSession::STATUS_OPEN,
        'opening_float' => '30.00',
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

test('with the drawer count off, closing a shift finishes it outright', function (): void {
    // The default desk: no count, no manager review. Closing means closed.
    Setting::query()->where('key', 'shifts.require_cash_count')->update(['value' => false]);

    $shiftUser = User::factory()->create();
    $shiftUser->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($shiftUser);

    $shift = EmployeeShift::factory()->create(['name' => 'All Day']);
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
        ->assertOk()
        ->assertJsonPath('data.status', ShiftSession::STATUS_AUTO_ACCEPTED);

    $closed = $session->fresh();

    // Nothing is left waiting for a human, and the money the system recorded is
    // still stored — the totals are not the thing being skipped, the chore is.
    expect($closed->closed_at)->not->toBeNull()
        ->and($closed->admin_decision)->toBe('accepted')
        ->and($closed->admin_reviewed_at)->not->toBeNull()
        ->and($closed->expected_net)->not->toBeNull();

    // And the desk is free: a finished session must not block the next one.
    expect(ShiftSession::query()->whereIn('status', [
        ShiftSession::STATUS_PENDING_HANDOVER,
        ShiftSession::STATUS_PENDING_ADMIN,
        ShiftSession::STATUS_DISPUTED,
    ])->count())->toBe(0);
});

