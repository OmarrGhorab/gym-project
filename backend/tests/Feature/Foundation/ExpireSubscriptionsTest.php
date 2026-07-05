<?php

use App\Actions\Subscriptions\ExpireDueSubscriptions;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('expire subscriptions action only expires past end date active subscriptions', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $expiredTarget = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-09',
    ]);

    $stillActive = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-12',
    ]);

    $frozen = Subscription::factory()->frozen()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-09',
    ]);

    $stopped = Subscription::factory()->stopped()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-09',
    ]);

    $count = app(ExpireDueSubscriptions::class)->handle();

    expect($count)->toBe(1);

    $expiredTarget->refresh();
    $stillActive->refresh();
    $frozen->refresh();
    $stopped->refresh();

    expect($expiredTarget->status)->toBe('expired')
        ->and($stillActive->status)->toBe('active')
        ->and($frozen->status)->toBe('frozen')
        ->and($stopped->status)->toBe('stopped');
});

test('expire subscriptions action respects plan access grace days', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['access_grace_days' => 3]);

    $withinGrace = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-08',
    ]);

    $pastGrace = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-06',
    ]);

    $count = app(ExpireDueSubscriptions::class)->handle();

    expect($count)->toBe(1)
        ->and($withinGrace->refresh()->status)->toBe('active')
        ->and($pastGrace->refresh()->status)->toBe('expired');
});
