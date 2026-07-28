<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('the scheduled command opens the current shift once and an assigned employee closes it manually', function (): void {
    Carbon::setTestNow('2026-07-28 06:30:00');

    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    $shift = EmployeeShift::factory()->create([
        'starts_at' => '06:00:00',
        'ends_at' => '11:00:00',
    ]);
    $employee = Employee::factory()->create([
        'user_id' => $user->id,
        'shift_id' => $shift->id,
        'status' => 'active',
    ]);

    $this->artisan('shifts:auto-open')->assertSuccessful();
    $this->artisan('shifts:auto-open')->assertSuccessful();

    $session = ShiftSession::query()->sole();
    expect($session->employee_shift_id)->toBe($shift->id)
        ->and($session->business_date?->toDateString())->toBe('2026-07-28')
        ->and($session->opened_at?->format('H:i:s'))->toBe('06:00:00')
        ->and($session->opened_by)->toBeNull()
        ->and($session->opened_by_employee_id)->toBeNull()
        ->and($session->status)->toBe(ShiftSession::STATUS_OPEN);

    Sanctum::actingAs($user);
    $this->getJson('/api/v1/shift-sessions/current')
        ->assertOk()
        ->assertJsonPath('data.opened_automatically', true);

    $this->postJson("/api/v1/shift-sessions/{$session->id}/close")
        ->assertOk()
        ->assertJsonPath('data.status', ShiftSession::STATUS_PENDING_HANDOVER);

    expect($session->fresh()->closed_by_employee_id)->toBe($employee->id);
});

test('an overnight shift keeps the date on which its desk opened', function (): void {
    Carbon::setTestNow('2026-07-29 00:30:00');

    $shift = EmployeeShift::factory()->create([
        'starts_at' => '21:00:00',
        'ends_at' => '01:00:00',
    ]);
    Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);

    $this->artisan('shifts:auto-open')->assertSuccessful();

    $session = ShiftSession::query()->sole();
    expect($session->business_date?->toDateString())->toBe('2026-07-28')
        ->and($session->opened_at?->format('Y-m-d H:i:s'))->toBe('2026-07-28 21:00:00');
});

test('automatic opening can be disabled and respects a pending handover', function (): void {
    Carbon::setTestNow('2026-07-28 06:30:00');

    $shift = EmployeeShift::factory()->create(['starts_at' => '06:00:00', 'ends_at' => '11:00:00']);
    Employee::factory()->create(['shift_id' => $shift->id, 'status' => 'active']);
    Setting::query()->create(['key' => 'shifts.auto_open_enabled', 'value' => false]);

    $this->artisan('shifts:auto-open')->assertSuccessful();
    expect(ShiftSession::query()->count())->toBe(0);

    Setting::query()->where('key', 'shifts.auto_open_enabled')->update(['value' => true]);
    ShiftSession::query()->create([
        'employee_shift_id' => EmployeeShift::factory()->create()->id,
        'business_date' => '2026-07-28',
        'opened_at' => '2026-07-28 01:00:00',
        'closed_at' => '2026-07-28 05:00:00',
        'status' => ShiftSession::STATUS_PENDING_HANDOVER,
        'opening_float' => '0.00',
    ]);

    $this->artisan('shifts:auto-open')->assertSuccessful();
    expect(ShiftSession::query()->count())->toBe(1);
});
