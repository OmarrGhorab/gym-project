<?php

use App\Models\Employee;
use App\Models\Member;
use App\Models\MemberVisit;
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
        ->assertJsonPath('data.coaches.0.coach_name', 'Coach Captain Omar')
        ->assertJsonPath('data.coaches.0.subscribed_members_count', 1)
        ->assertJsonPath('data.coaches.0.attended_days_count', 2)
        ->assertJsonPath('data.coaches.0.members.0.member_name', 'Member Sherif')
        ->assertJsonPath('data.coaches.0.members.0.attended_days_this_month', 2);
});
