<?php

use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);

    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);
});

test('focusing a plan lists only that plan members subscribed inside the date range', function (): void {
    $gold = Plan::factory()->active()->create(['name' => 'Gold Monthly', 'price' => '800.00']);
    $silver = Plan::factory()->active()->create(['name' => 'Silver Monthly', 'price' => '500.00']);

    $inRange = Member::factory()->active()->create(['name' => 'In Range Gold']);
    $outOfRange = Member::factory()->active()->create(['name' => 'Out Of Range Gold']);
    $otherPlan = Member::factory()->active()->create(['name' => 'Silver Member']);

    Subscription::factory()->create([
        'member_id' => $inRange->id,
        'plan_id' => $gold->id,
        'status' => 'active',
        'price_paid' => '800.00',
        'created_at' => '2026-07-28 10:00:00',
    ]);
    Subscription::factory()->create([
        'member_id' => $outOfRange->id,
        'plan_id' => $gold->id,
        'status' => 'active',
        'price_paid' => '800.00',
        'created_at' => '2026-06-01 10:00:00',
    ]);
    Subscription::factory()->create([
        'member_id' => $otherPlan->id,
        'plan_id' => $silver->id,
        'status' => 'active',
        'price_paid' => '500.00',
        'created_at' => '2026-07-28 10:00:00',
    ]);

    $response = $this->getJson("/api/v1/reports/classes-plans?from=2026-07-28&to=2026-07-28&plan_id={$gold->id}")
        ->assertOk()
        ->assertJsonPath('data.selected_plan_id', $gold->id)
        ->assertJsonPath('data.subscriptions_total', 1);

    expect(collect($response->json('data.subscriptions'))->pluck('member_name')->all())
        ->toBe(['In Range Gold']);
});

test('focusing a plan still returns every plan so the picker stays usable', function (): void {
    $gold = Plan::factory()->active()->create(['name' => 'Gold Monthly']);
    $silver = Plan::factory()->active()->create(['name' => 'Silver Monthly']);

    $response = $this->getJson("/api/v1/reports/classes-plans?plan_id={$gold->id}")->assertOk();

    expect(collect($response->json('data.plans_summary'))->pluck('id')->all())
        ->toContain($gold->id, $silver->id);
});
