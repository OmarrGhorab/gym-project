<?php

use App\Models\Employee;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Support\FoundationPermissions;
use Carbon\Carbon;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can view coach extra plans report with member attendance', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $coach = Employee::factory()->create([
        'name' => 'Coach Captain Omar',
        'role' => 'Coach',
        'status' => 'active',
    ]);

    $member = Member::factory()->create(['name' => 'Member Sherif']);
    $plan = Plan::factory()->create(['name' => 'PT 10 Sessions Add-on']);
    $subscription = Subscription::factory()->active()->create(['member_id' => $member->id]);

    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'status' => 'active',
        'price_paid' => '1200.00',
        'sessions_total' => 10,
        'sessions_remaining' => 7,
    ]);
    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '800.00',
        'status' => 'paid',
        'paid_at' => '2026-07-02 11:00:00',
    ]);

    MemberVisit::query()->create([
        'member_id' => $member->id,
        'subscription_id' => $subscription->id,
        'subscription_addon_id' => $addon->id,
        'check_in_at' => '2026-07-05 14:00:00',
        'status' => 'completed',
    ]);
    MemberVisit::query()->create([
        'member_id' => $member->id,
        'subscription_id' => $subscription->id,
        'subscription_addon_id' => $addon->id,
        'check_in_at' => '2026-07-10 16:30:00',
        'status' => 'completed',
    ]);

    $response = $this->getJson('/api/v1/reports/coach-extra-plans?from=2026-07-01&to=2026-07-31')
        ->assertOk()
        ->assertJsonPath('data.kpis.total_coached_addons', 1)
        ->assertJsonPath('data.kpis.total_subscribed_members', 1)
        ->assertJsonPath('data.kpis.total_attended_days', 2)
        ->assertJsonPath('data.kpis.total_addon_revenue', '800.00')
        ->assertJsonPath('data.coaches.0.coach_name', 'Coach Captain Omar')
        ->assertJsonPath('data.coaches.0.subscribed_members_count', 1)
        ->assertJsonPath('data.coaches.0.attended_days_count', 2)
        ->assertJsonPath('data.coaches.0.members.0.member_name', 'Member Sherif')
        ->assertJsonPath('data.coaches.0.members.0.attended_days_this_month', 2)
        ->assertJsonPath('data.coaches.0.members.0.total_visits_this_month', 2)
        ->assertJsonPath('data.coaches.0.members.0.sessions_used', 2)
        ->assertJsonPath('data.coaches.0.members.0.paid_amount', '800.00')
        ->assertJsonPath('data.coaches.0.members.0.payment_dates.0', '2026-07-02')
        ->assertJsonPath('data.coaches.0.members.0.attendance_dates.0.date', '2026-07-05')
        ->assertJsonPath('data.coaches.0.members.0.attendance_dates.0.visits', 1);
});

test('coach extra plans report excludes active plans outside the selected date range', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $coach = Employee::factory()->create(['role' => 'Coach', 'status' => 'active']);
    $member = Member::factory()->create();
    $plan = Plan::factory()->create();
    $subscription = Subscription::factory()->active()->create(['member_id' => $member->id]);

    SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-08-01',
        'end_date' => '2026-08-31',
        'status' => 'active',
        'price_paid' => '1200.00',
    ]);

    $this->getJson('/api/v1/reports/coach-extra-plans?from=2026-06-01&to=2026-06-30')
        ->assertOk()
        ->assertJsonPath('data.kpis.total_coached_addons', 0)
        ->assertJsonPath('data.kpis.total_subscribed_members', 0);
});

test('included coached services use net parent package payments and distinguish stopped rows', function (): void {
    Carbon::setTestNow('2026-07-28 12:00:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $coach = Employee::factory()->create([
        'name' => 'Captain Youssef',
        'role' => 'Coach',
        'status' => 'active',
    ]);
    $package = Plan::factory()->create([
        'name' => 'Gym and Nutrition Package',
        'price' => '1200.00',
    ]);
    $includedPlan = Plan::factory()->create([
        'name' => 'Nutrition Follow-up',
        'price' => '300.00',
    ]);
    $activeMember = Member::factory()->create(['name' => 'Active Member']);
    $stoppedMember = Member::factory()->create(['name' => 'Refunded Member']);

    $activeSubscription = Subscription::factory()->create([
        'member_id' => $activeMember->id,
        'plan_id' => $package->id,
        'status' => 'active',
        'price_paid' => '1200.00',
        'start_date' => '2026-07-28',
        'end_date' => '2026-08-27',
    ]);
    $stoppedSubscription = Subscription::factory()->create([
        'member_id' => $stoppedMember->id,
        'plan_id' => $package->id,
        'status' => 'stopped',
        'price_paid' => '1200.00',
        'start_date' => '2026-07-27',
        'end_date' => '2026-07-28',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $activeSubscription->id,
        'amount' => '1200.00',
        'status' => 'paid',
        'paid_at' => '2026-07-28 10:00:00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $stoppedSubscription->id,
        'amount' => '1200.00',
        'status' => 'paid',
        'paid_at' => '2026-07-27 10:00:00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $stoppedSubscription->id,
        'amount' => '-1200.00',
        'status' => 'refunded',
        'paid_at' => '2026-07-28 11:00:00',
    ]);

    foreach ([
        [$activeSubscription, $activeMember, 'active', 12],
        [$stoppedSubscription, $stoppedMember, 'stopped', 0],
    ] as [$subscription, $member, $status, $remaining]) {
        SubscriptionAddon::query()->create([
            'subscription_id' => $subscription->id,
            'member_id' => $member->id,
            'plan_id' => $includedPlan->id,
            'coach_id' => $coach->id,
            'start_date' => $subscription->start_date,
            'end_date' => $subscription->end_date,
            'status' => $status,
            'price_paid' => '0.00',
            'discount' => '300.00',
            'sessions_total' => 12,
            'sessions_remaining' => $remaining,
        ]);
    }

    $this->getJson('/api/v1/reports/coach-extra-plans?from=2026-07-28&to=2026-07-28')
        ->assertOk()
        ->assertJsonPath('data.kpis.total_coached_addons', 1)
        ->assertJsonPath('data.kpis.total_subscribed_members', 1)
        ->assertJsonPath('data.kpis.total_addon_revenue', '1200.00')
        ->assertJsonPath('data.coaches.0.subscribed_members_count', 1)
        ->assertJsonPath('data.coaches.0.subscription_rows_count', 2)
        ->assertJsonPath('data.coaches.0.stopped_subscriptions_count', 1)
        ->assertJsonPath('data.coaches.0.total_revenue', '1200.00')
        ->assertJsonPath('data.coaches.0.members.0.payment_source', 'parent_package')
        ->assertJsonPath('data.coaches.0.members.0.payment_plan_name', 'Gym and Nutrition Package')
        ->assertJsonPath('data.coaches.0.members.0.payment_price', '1200.00')
        ->assertJsonPath('data.coaches.0.members.0.paid_amount', '1200.00')
        ->assertJsonPath('data.coaches.0.members.0.sessions_used', 0)
        ->assertJsonPath('data.coaches.0.members.1.paid_amount', '0.00')
        ->assertJsonPath('data.coaches.0.members.1.payment_breakdown.0.amount', '1200.00')
        ->assertJsonPath('data.coaches.0.members.1.payment_breakdown.0.status', 'paid')
        ->assertJsonPath('data.coaches.0.members.1.payment_breakdown.1.amount', '-1200.00')
        ->assertJsonPath('data.coaches.0.members.1.payment_breakdown.1.status', 'refunded')
        ->assertJsonPath('data.coaches.0.members.1.sessions_used', 0)
        ->assertJsonPath('data.coaches.0.members.1.sessions_remaining', 0);
});
