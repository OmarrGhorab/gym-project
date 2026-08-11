<?php

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Member;
use App\Models\MemberVisit;
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

test('accountant can view live gym attendance summary', function (): void {
    Carbon::setTestNow('2026-06-29 10:30:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $memberInside = Member::factory()->create(['name' => 'Inside Member']);
    $blockedMember = Member::factory()->create(['name' => 'Blocked Member']);
    $employee = Employee::factory()->create(['name' => 'Late Captain', 'role' => 'captain']);

    MemberVisit::factory()->create([
        'member_id' => $memberInside->id,
        'check_in_at' => Carbon::now()->subMinutes(45),
        'check_out_at' => null,
        'status' => 'allowed',
        'scan_method' => 'qr',
        'check_in_location_status' => 'inside',
    ]);

    MemberVisit::factory()->create([
        'member_id' => $blockedMember->id,
        'check_in_at' => Carbon::now()->subMinutes(15),
        'check_out_at' => null,
        'status' => 'blocked',
        'scan_method' => 'phone',
        'alert_reason' => 'Subscription expired',
    ]);

    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => Carbon::today()->toDateString(),
        'check_in' => '09:20',
        'check_out' => null,
        'status' => 'present',
        'scan_method' => 'qr',
        'check_in_location_status' => 'inside',
    ]);

    $this->getJson('/api/v1/reports/live-attendance')
        ->assertOk()
        ->assertJsonPath('data.currently_inside.total', 2)
        ->assertJsonPath('data.currently_inside.members', 1)
        ->assertJsonPath('data.currently_inside.staff', 1)
        ->assertJsonPath('data.today.member_visits', 2)
        ->assertJsonPath('data.today.staff_checkins', 1)
        ->assertJsonPath('data.today.blocked_visits', 1)
        ->assertJsonPath('data.today.staff_still_in', 1)
        ->assertJsonFragment(['name' => 'Late Captain'])
        ->assertJsonFragment(['name' => 'Blocked Member'])
        ->assertJsonMissingPath('data.currently_inside_rows.2')
        ->assertJsonStructure([
            'data' => [
                'generated_at',
                'currently_inside' => ['total', 'members', 'staff'],
                'today' => ['member_visits', 'staff_checkins', 'flagged_scans', 'blocked_visits', 'staff_still_in', 'peak_hour'],
                'hourly' => [
                    '*' => ['hour', 'members', 'staff', 'total'],
                ],
                'scan_methods' => [
                    '*' => ['method', 'count'],
                ],
                'currently_inside_rows' => [
                    '*' => ['id', 'name', 'type', 'check_in_at', 'duration_minutes', 'scan_method', 'status', 'location_status'],
                ],
                'alerts' => [
                    '*' => ['id', 'severity', 'type', 'name', 'message', 'time'],
                ],
            ],
        ]);
});

test('users without reports permission cannot view live attendance summary', function (): void {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/live-attendance')
        ->assertForbidden();
});

test('live attendance summary supports chart filters', function (): void {
    Carbon::setTestNow('2026-06-29 10:30:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $member = Member::factory()->create();
    $employee = Employee::factory()->create();

    MemberVisit::factory()->create([
        'member_id' => $member->id,
        'check_in_at' => Carbon::parse('2026-06-29 09:10:00'),
        'check_out_at' => Carbon::parse('2026-06-29 10:05:00'),
        'status' => 'allowed',
    ]);

    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-06-29',
        'check_in' => '09:20',
        'check_out' => null,
        'status' => 'present',
    ]);

    $this->getJson('/api/v1/reports/live-attendance?date=2026-06-29&hours=6&audience=members&metric=entries')
        ->assertOk()
        ->assertJsonPath('data.filters.date', '2026-06-29')
        ->assertJsonPath('data.filters.hours', 6)
        ->assertJsonPath('data.filters.audience', 'members')
        ->assertJsonPath('data.filters.metric', 'entries')
        ->assertJsonCount(6, 'data.hourly')
        ->assertJsonFragment([
            'hour' => '09:00',
            'members' => 1,
            'staff' => 1,
            'total' => 2,
            'value' => 1,
        ]);

    $this->getJson('/api/v1/reports/live-attendance?hours=99')
        ->assertUnprocessable();
});

test('live attendance summary includes staff currently checked in without member visits', function (): void {
    Carbon::setTestNow('2026-07-07 17:10:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $employee = Employee::factory()->create(['name' => 'Sara Mounir', 'role' => 'coach']);

    Attendance::factory()->create([
        'employee_id' => $employee->id,
        'date' => '2026-07-07',
        'check_in' => '17:01',
        'check_out' => null,
        'status' => 'late',
        'scan_method' => 'manual',
    ]);

    $this->getJson('/api/v1/reports/live-attendance?date=2026-07-07&hours=24&audience=all&metric=occupancy')
        ->assertOk()
        ->assertJsonPath('data.currently_inside.total', 1)
        ->assertJsonPath('data.currently_inside.staff', 1)
        ->assertJsonPath('data.today.staff_checkins', 1)
        ->assertJsonPath('data.scan_methods.0.method', 'manual')
        ->assertJsonPath('data.scan_methods.0.count', 1)
        ->assertJsonFragment(['name' => 'Sara Mounir']);
});
