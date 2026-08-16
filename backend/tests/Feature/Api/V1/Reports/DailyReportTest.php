<?php

use App\Models\Attendance;
use App\Models\DailyReport;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
    Carbon::setTestNow('2026-08-18 06:00:00');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function reportAdmin(): User
{
    $admin = User::factory()->create(['name' => 'Owner']);
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    return $admin;
}

/**
 * A day of trading on the gym's clock: money taken in the evening and again
 * after midnight, both belonging to the 17th.
 */
function seedTradingDay(User $desk): void
{
    $subscription = Subscription::factory()->create(['sold_by_user_id' => $desk->id]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '1200.00',
        'method' => 'cash',
        'status' => Payment::COLLECTED_STATUSES[0],
        'paid_at' => Carbon::parse('2026-08-17 20:00:00'),
        'created_by' => $desk->id,
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'card',
        'status' => Payment::COLLECTED_STATUSES[0],
        // After midnight, still the 17th's trading.
        'paid_at' => Carbon::parse('2026-08-18 01:30:00'),
        'created_by' => $desk->id,
    ]);

    Expense::factory()->create([
        'amount' => '200.00',
        'category' => 'maintenance',
        'date' => '2026-08-17',
        'created_by' => $desk->id,
    ]);
}

test('the report covers the working day, not the calendar day', function (): void {
    $admin = reportAdmin();
    $desk = User::factory()->create(['name' => 'Desk Staff']);
    $desk->assignRole(FoundationPermissions::ROLE_CASHIER);
    seedTradingDay($desk);

    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/reports/daily?date=2026-08-17')
        ->assertOk()
        // 1200 cash + 300 card, the second taken at 01:30 the next morning.
        ->assertJsonPath('data.money.collections', '1500.00')
        ->assertJsonPath('data.money.by_method.cash', '1200.00')
        ->assertJsonPath('data.money.by_method.card', '300.00')
        ->assertJsonPath('data.money.expenses', '200.00')
        ->assertJsonPath('data.money.net', '1300.00');
});

/** The whole point: an amount with nobody's name against it cannot be asked about. */
test('every amount carries the name of who handled it', function (): void {
    $admin = reportAdmin();
    $desk = User::factory()->create(['name' => 'Desk Staff']);
    $desk->assignRole(FoundationPermissions::ROLE_CASHIER);
    seedTradingDay($desk);

    Sanctum::actingAs($admin);
    $data = $this->getJson('/api/v1/reports/daily?date=2026-08-17')->assertOk()->json('data');

    expect($data['by_staff'])->toHaveCount(1)
        ->and($data['by_staff'][0]['name'])->toBe('Desk Staff')
        ->and($data['by_staff'][0]['collected'])->toBe('1500.00')
        ->and($data['by_staff'][0]['spent'])->toBe('200.00')
        ->and($data['by_staff'][0]['payment_count'])->toBe(2)
        ->and(collect($data['payments'])->pluck('recorded_by')->unique()->all())->toBe(['Desk Staff'])
        ->and($data['expenses'][0]['recorded_by'])->toBe('Desk Staff');
});

test('it reports who was absent and who never scanned', function (): void {
    $admin = reportAdmin();
    $shift = EmployeeShift::factory()->create(['name' => 'Day Desk']);

    $present = Employee::factory()->create(['name' => 'Present Staff', 'shift_id' => $shift->id, 'status' => 'active']);
    $absent = Employee::factory()->create(['name' => 'Absent Staff', 'shift_id' => $shift->id, 'status' => 'active']);
    Employee::factory()->create(['name' => 'Never Scanned', 'shift_id' => $shift->id, 'status' => 'active']);

    Attendance::query()->create([
        'employee_id' => $present->id,
        'shift_id' => $shift->id,
        'date' => '2026-08-17',
        'check_in' => '2026-08-17 09:00:00',
        'check_out' => '2026-08-17 17:00:00',
        'status' => 'present',
    ]);
    Attendance::query()->create([
        'employee_id' => $absent->id,
        'shift_id' => $shift->id,
        'date' => '2026-08-17',
        'status' => 'absent',
    ]);

    Sanctum::actingAs($admin);
    $totals = $this->getJson('/api/v1/reports/daily?date=2026-08-17')
        ->assertOk()
        ->json('data.attendance.totals');

    expect($totals['present'])->toBe(1)
        ->and($totals['absent'])->toBe(1)
        ->and($totals['no_scan'])->toBe(1)
        ->and($totals['employees'])->toBe(3);
});

test('it lists each shift with the employee who held the drawer', function (): void {
    $admin = reportAdmin();
    $shift = EmployeeShift::factory()->create(['name' => 'Evening']);
    $employee = Employee::factory()->create(['name' => 'Evening Staff', 'shift_id' => $shift->id, 'status' => 'active']);

    ShiftSession::query()->create([
        'employee_shift_id' => $shift->id,
        'business_date' => '2026-08-17',
        'opened_at' => '2026-08-17 17:00:00',
        'closed_at' => '2026-08-18 03:00:00',
        'opened_by' => $admin->id,
        'opened_by_employee_id' => $employee->id,
        'status' => ShiftSession::STATUS_ACCEPTED,
        'opening_float' => '500.00',
        'expected_cash' => '1700.00',
        'counted_cash' => '1650.00',
    ]);

    Sanctum::actingAs($admin);
    $shifts = $this->getJson('/api/v1/reports/daily?date=2026-08-17')->assertOk()->json('data.shifts');

    expect($shifts)->toHaveCount(1)
        ->and($shifts[0]['staff'])->toBe('Evening Staff')
        ->and($shifts[0]['shift'])->toBe('Evening')
        // Counted 50 short of expected, and the report says so rather than hiding it.
        ->and($shifts[0]['variance'])->toBe('-50.00');
});

test('the scheduled job notifies the admins once for the day that just ended', function (): void {
    Notification::fake();
    Storage::fake('local');
    $admin = reportAdmin();
    $desk = User::factory()->create(['name' => 'Desk Staff']);
    seedTradingDay($desk);

    // 06:00 on the 18th: the day that just ended is the 17th.
    $this->artisan('reports:send-daily')->assertSuccessful();

    Notification::assertSentTo($admin, OperationalNotification::class, function ($notification) use ($admin) {
        $data = $notification->toArray($admin);

        return $data['category'] === 'reports.daily' && $data['business_date'] === '2026-08-17';
    });

    expect(DailyReport::query()->whereDate('business_date', '2026-08-17')->value('sent_at'))->not->toBeNull();

    // A second tick must not put the same day in the bell again. Counted by
    // category, since seeding the day's trading raises its own notifications.
    $this->artisan('reports:send-daily')->assertSuccessful();

    $dailyReports = Notification::sent($admin, OperationalNotification::class)
        ->filter(fn ($notification): bool => $notification->toArray($admin)['category'] === 'reports.daily');

    expect($dailyReports)->toHaveCount(1);
});

/**
 * A cashier holds reports.view, so that alone cannot guard a page listing every
 * amount of the day against the name of whoever took it.
 */
test('staff without the money reports permission cannot read the day', function (): void {
    $cashier = User::factory()->create();
    $cashier->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($cashier);

    expect($cashier->can('reports.view'))->toBeTrue();

    $this->getJson('/api/v1/reports/daily?date=2026-08-17')->assertStatus(403);
    $this->get('/api/v1/reports/daily/pdf?date=2026-08-17')->assertStatus(403);
});

test('the daily report requires authentication', function (): void {
    $this->getJson('/api/v1/reports/daily')->assertStatus(401);
});
