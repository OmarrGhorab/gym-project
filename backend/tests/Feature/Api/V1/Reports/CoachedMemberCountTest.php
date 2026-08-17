<?php

use App\Actions\Commissions\CalculateCommission;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
});

/**
 * A member on a coached studio plan, signed up by the front desk rather than by
 * the coach — the ordinary case, and the one that used to count for nobody.
 */
function coachedMembership(string $commissionValue): array
{
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $coach = Employee::factory()->create(['role' => 'coach', 'status' => 'active']);

    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $plan->id,
        'calculation_type' => 'percentage',
        'value' => $commissionValue,
        'is_active' => true,
    ]);

    $subscription = Subscription::factory()->for(Member::factory()->active()->create())->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
        'price_paid' => '500.00',
        'start_date' => now()->startOfMonth()->toDateString(),
        'end_date' => now()->endOfMonth()->toDateString(),
    ]);

    app(CalculateCommission::class)->forSource($subscription);

    return [$coach, $subscription];
}

function employeeReportRow(int $coachId): array
{
    $from = now()->startOfMonth()->toDateString();
    $to = now()->endOfMonth()->toDateString();

    $rows = test()->getJson("/api/v1/reports/employees?from={$from}&to={$to}")
        ->assertStatus(200)
        ->json('data');

    return collect($rows)->firstWhere('employee_id', $coachId) ?? [];
}

test('a coach on a plan paying no commission still shows the members they run', function (): void {
    [$coach] = coachedMembership('0.0000');

    // The reported symptom: every figure on the row read zero, so the coach
    // looked like they had nobody.
    expect(employeeReportRow($coach->id)['coached_services_count'])->toBe(1);
});

test('a coach is counted for a member the front desk signed up, not only their own sales', function (): void {
    [$coach] = coachedMembership('20.0000');

    $row = employeeReportRow($coach->id);

    // Sold by somebody else, so the sales figure stays nil — but the coaching counts.
    expect($row['subscriptions_count'])->toBe(0)
        ->and($row['coached_services_count'])->toBe(1)
        ->and($row['coached_services_revenue'])->toBe('500.00');
});

test('the academy highlights count coached memberships too, not just add-ons', function (): void {
    [$coach] = coachedMembership('0.0000');

    $from = now()->startOfMonth()->toDateString();
    $to = now()->endOfMonth()->toDateString();

    $highlights = test()->getJson("/api/v1/reports/staff-academy?from={$from}&to={$to}")
        ->assertStatus(200)
        ->json('data.performance_highlights');

    $row = collect($highlights)->firstWhere('employee_id', $coach->id);

    expect($row)->not->toBeNull()
        ->and($row['coached_services_count'])->toBe(1);
});

test('the coach drill-down lists the credit even when it is worth nothing', function (): void {
    [$coach, $subscription] = coachedMembership('0.0000');

    $from = now()->startOfMonth()->toDateString();
    $to = now()->endOfMonth()->toDateString();

    $performance = test()->getJson("/api/v1/employees/{$coach->id}/performance?from={$from}&to={$to}")
        ->assertStatus(200)
        ->json('data');

    $credit = collect($performance['commissions'] ?? [])->firstWhere('source_id', $subscription->id);

    expect($credit)->not->toBeNull()
        ->and($credit['amount'])->toBe('0.00');
});

test('a coach with nobody on their books still reports zero', function (): void {
    $coach = Employee::factory()->create(['role' => 'coach', 'status' => 'active']);

    expect(employeeReportRow($coach->id)['coached_services_count'])->toBe(0);
});
