<?php

use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('staff can open close and submit matching handover for admin review', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $shift = EmployeeShift::factory()->create();

    $open = $this->postJson('/api/v1/shift-sessions', [
        'employee_shift_id' => $shift->id,
        'opening_float' => '100.00',
        'force_open' => true,
    ])->assertStatus(201);

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

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/handover", [
        'counted_cash' => '150.00',
        'counted_card' => '20.00',
        'counted_bank' => '0.00',
        'counted_expenses' => '10.00',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'pending_admin');

    $this->postJson("/api/v1/shift-sessions/{$sessionId}/review", [
        'decision' => 'accepted',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'accepted');
});

test('auto accept setting accepts matching handover without admin', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept'], ['value' => true]);
    Setting::query()->updateOrCreate(['key' => 'shifts.handover_auto_accept_on_match_only'], ['value' => true]);

    $shift = EmployeeShift::factory()->create();
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

test('require handover blocks opening a new session', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::query()->updateOrCreate(['key' => 'shifts.require_handover_to_open'], ['value' => true]);

    $shiftA = EmployeeShift::factory()->create();
    $shiftB = EmployeeShift::factory()->create();

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
