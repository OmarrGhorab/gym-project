<?php

use App\Actions\Attendance\SendDailyAttendanceReport;
use App\Models\Attendance;
use App\Models\DailyAttendanceReport;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

function reportDayEmployees(): array
{
    $shift = EmployeeShift::factory()->create([
        'name' => 'Morning 9-5',
    ]);

    $late = Employee::factory()->create([
        'name' => 'Full Day',
        'shift_id' => $shift->id,
        'status' => 'active',
    ]);
    $early = Employee::factory()->create([
        'name' => 'Still Working',
        'shift_id' => $shift->id,
        'status' => 'active',
    ]);
    $absent = Employee::factory()->create([
        'name' => 'Never Scanned',
        'shift_id' => $shift->id,
        'status' => 'active',
    ]);

    Attendance::factory()->create([
        'employee_id' => $late->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '09:45',
        'check_out' => '17:00',
        'status' => 'present',
    ]);
    Attendance::factory()->create([
        'employee_id' => $early->id,
        'shift_id' => $shift->id,
        'date' => '2026-07-20',
        'check_in' => '09:00',
        'check_out' => null,
        'status' => 'present',
    ]);

    return [$late, $early, $absent];
}

test('the daily report lists every active employee, including the ones who never scanned', function (): void {
    [, , $absent] = reportDayEmployees();

    $report = app(\App\Actions\Attendance\BuildDailyAttendanceReport::class)
        ->data(Carbon::parse('2026-07-20'));

    expect($report['rows'])->toHaveCount(3)
        ->and($report['totals']['records_count'])->toBe(2)
        ->and($report['totals']['still_in_count'])->toBe(1)
        ->and($report['totals']['no_scan_count'])->toBe(1);

    // 09:45 to 17:00 is 7h15m of worked time.
    $worked = collect($report['rows'])->firstWhere('employee', 'Full Day');
    expect($worked['hours'])->toBe('7:15');

    $missing = collect($report['rows'])->firstWhere('employee_id', $absent->id);

    expect($missing['status'])->toBe('no_scan')
        ->and($missing['check_in'])->toBe('-')
        ->and($missing['check_out'])->toBe('-');
});

test('sending the daily report stores the pdf and notifies admins once', function (): void {
    Storage::fake(config('export.disk', 'local'));
    reportDayEmployees();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    $action = app(SendDailyAttendanceReport::class);
    $first = $action->handle(Carbon::parse('2026-07-20'));

    expect($first['sent'])->toBeTrue();
    Storage::disk(config('export.disk', 'local'))
        ->assertExists('attendance-reports/daily-attendance-2026-07-20.pdf');

    $notification = $admin->notifications()->latest()->first();

    expect($notification?->data['category'])->toBe('attendance.daily_report')
        ->and($notification?->data['records_count'])->toBe(2)
        ->and($notification?->data['no_scan_count'])->toBe(1)
        ->and($notification?->data['url'])->toBe('/dashboard/attendance?report_date=2026-07-20');

    // A second tick on the same day must not notify again.
    $second = $action->handle(Carbon::parse('2026-07-20'));

    expect($second['sent'])->toBeFalse()
        ->and($second['reason'])->toBe('already_sent')
        ->and($admin->notifications()->count())->toBe(1)
        ->and(DailyAttendanceReport::query()->count())->toBe(1);
});

test('an admin can pull the day sheet as a pdf', function (): void {
    reportDayEmployees();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->get('/api/v1/attendance/daily-report?date=2026-07-20')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');
});

test('the daily report endpoint rejects a malformed date', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/attendance/daily-report?date=20-07-2026')
        ->assertStatus(422);
});

test('a user without attendance access cannot pull the day sheet', function (): void {
    Sanctum::actingAs(User::factory()->create());

    $this->getJson('/api/v1/attendance/daily-report?date=2026-07-20')
        ->assertForbidden();
});

test('an unauthenticated request for the day sheet is rejected', function (): void {
    $this->getJson('/api/v1/attendance/daily-report?date=2026-07-20')
        ->assertUnauthorized();
});

test('the scheduled command builds and sends the report', function (): void {
    Storage::fake(config('export.disk', 'local'));
    reportDayEmployees();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    $this->artisan('attendance:send-daily-report', ['--date' => '2026-07-20'])
        ->assertSuccessful();

    expect(DailyAttendanceReport::query()->whereDate('business_date', '2026-07-20')->first()?->sent_at)
        ->not->toBeNull()
        ->and($admin->notifications()->count())->toBe(1);
});
