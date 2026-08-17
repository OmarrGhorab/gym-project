<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Plan;
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

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
});

/** A coach assigned to $plan at the given commission rate. */
function coachFor(Plan $plan, string $value = '20.0000'): Employee
{
    $coach = Employee::factory()->create(['role' => 'coach', 'status' => 'active']);

    EmployeePlanCommissionRule::create([
        'employee_id' => $coach->id,
        'plan_id' => $plan->id,
        'calculation_type' => 'percentage',
        'value' => $value,
        'is_active' => true,
    ]);

    return $coach;
}

test('the coach on a membership is exposed so a correction can show who is on it', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $coach = coachFor($plan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
    ]);

    test()->getJson("/api/v1/subscriptions/{$subscription->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.coach_id', $coach->id)
        ->assertJsonPath('data.coach.name', $coach->name);

    test()->getJson("/api/v1/members/{$member->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.latest_subscription.coach_id', $coach->id)
        ->assertJsonPath('data.latest_subscription.coach.name', $coach->name);
});

test('a membership can be moved to another coach on the same plan', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $original = coachFor($plan);
    $replacement = coachFor($plan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $original->id,
    ]);

    test()->patchJson("/api/v1/subscriptions/{$subscription->id}", ['coach_id' => $replacement->id])
        ->assertStatus(200)
        ->assertJsonPath('data.coach_id', $replacement->id);

    expect($subscription->fresh()->coach_id)->toBe($replacement->id);
});

test('a coach who does not run the plan is refused', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $otherPlan = Plan::factory()->active()->create(['category' => 'nutrition', 'price' => '300.00']);
    $coach = coachFor($plan);
    $strangerToThisPlan = coachFor($otherPlan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
    ]);

    test()->patchJson("/api/v1/subscriptions/{$subscription->id}", ['coach_id' => $strangerToThisPlan->id])
        ->assertStatus(422)
        ->assertJsonPath('error.details.coach_id.0', 'The selected coach is not assigned to this plan.');

    expect($subscription->fresh()->coach_id)->toBe($coach->id);
});

test('unsettled coaching credit follows the correction to the new coach', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $original = coachFor($plan);
    $replacement = coachFor($plan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $original->id,
        'price_paid' => '500.00',
    ]);

    // The sale wrote the original coach's pending credit.
    app(\App\Actions\Commissions\CalculateCommission::class)->forSource($subscription);
    expect(Commission::where('employee_id', $original->id)->where('commission_type', 'subscription_coach')->count())->toBe(1);

    test()->patchJson("/api/v1/subscriptions/{$subscription->id}", ['coach_id' => $replacement->id])
        ->assertStatus(200);

    expect(Commission::where('employee_id', $original->id)->where('commission_type', 'subscription_coach')->count())->toBe(0)
        ->and(Commission::where('employee_id', $replacement->id)->where('commission_type', 'subscription_coach')->count())->toBe(1);
});

test('coaching credit already paid through payroll is left alone', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $original = coachFor($plan);
    $replacement = coachFor($plan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $original->id,
        'price_paid' => '500.00',
    ]);

    app(\App\Actions\Commissions\CalculateCommission::class)->forSource($subscription);
    Commission::query()
        ->where('employee_id', $original->id)
        ->where('commission_type', 'subscription_coach')
        ->update(['status' => 'paid']);

    test()->patchJson("/api/v1/subscriptions/{$subscription->id}", ['coach_id' => $replacement->id])
        ->assertStatus(200);

    // Settled money stands: the payslip it went out on cannot be rewritten.
    expect(Commission::where('employee_id', $original->id)->where('status', 'paid')->count())->toBe(1)
        ->and(Commission::where('employee_id', $replacement->id)->where('commission_type', 'subscription_coach')->count())->toBe(1);
});

test('a coach on a plan paying no commission is still credited with the member', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $coach = coachFor($plan, '0.0000');
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
        'price_paid' => '500.00',
    ]);

    app(\App\Actions\Commissions\CalculateCommission::class)->forSource($subscription);

    // The regression: a zero-value rule wrote no row at all, so the member never
    // showed up as this coach's.
    $credit = Commission::where('employee_id', $coach->id)
        ->where('commission_type', 'subscription_coach')
        ->first();

    expect($credit)->not->toBeNull()
        ->and($credit->amount)->toBe('0.00')
        ->and($credit->source_id)->toBe($subscription->id);
});

test('a coach on a fully discounted membership is still credited with the member', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $coach = coachFor($plan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
        'price_paid' => '0.00',
        'discount' => '500.00',
    ]);

    app(\App\Actions\Commissions\CalculateCommission::class)->forSource($subscription);

    expect(Commission::where('employee_id', $coach->id)->where('commission_type', 'subscription_coach')->count())->toBe(1);
});

test('a membership can be handed back to no coach at all', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $coach = coachFor($plan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
    ]);

    test()->patchJson("/api/v1/subscriptions/{$subscription->id}", ['coach_id' => null])
        ->assertStatus(200)
        ->assertJsonPath('data.coach_id', null);

    expect($subscription->fresh()->coach_id)->toBeNull();
});

test('correcting dates without naming a coach leaves the coach where it was', function (): void {
    $plan = Plan::factory()->active()->create(['category' => 'fitness_studio', 'price' => '500.00']);
    $coach = coachFor($plan);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
    ]);

    test()->patchJson("/api/v1/subscriptions/{$subscription->id}", ['price_paid' => '450.00'])
        ->assertStatus(200);

    expect($subscription->fresh()->coach_id)->toBe($coach->id);
});
