<?php

use App\Actions\Subscriptions\AutoUnfreezeDueSubscriptions;
use App\Actions\Subscriptions\StopOverdueUnpaidSubscriptions;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

test('auto unfreeze resumes frozen subscriptions after the freeze window ends', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['max_freeze_days' => 5]);
    $subscription = Subscription::factory()->frozen()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-07-23',
    ]);
    SubscriptionFreeze::factory()->create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-07-05',
        'freeze_end' => '2026-07-09',
        'days' => 5,
        'remaining_days_at_freeze' => 18,
        'resumed_on' => null,
    ]);

    $count = app(AutoUnfreezeDueSubscriptions::class)->handle(Carbon::parse('2026-07-10'));

    $subscription->refresh();
    $freeze = $subscription->freezes()->first();

    expect($count)->toBe(1)
        ->and($subscription->status)->toBe('active')
        ->and($subscription->end_date->toDateString())->toBe('2026-07-28')
        ->and($freeze->resumed_on->toDateString())->toBe('2026-07-10');
});

test('auto unfreeze leaves current freeze windows frozen', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['max_freeze_days' => 5]);
    $subscription = Subscription::factory()->frozen()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);
    SubscriptionFreeze::factory()->create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-07-05',
        'freeze_end' => '2026-07-09',
        'days' => 5,
        'remaining_days_at_freeze' => 18,
        'resumed_on' => null,
    ]);

    $count = app(AutoUnfreezeDueSubscriptions::class)->handle(Carbon::parse('2026-07-09'));

    expect($count)->toBe(0)
        ->and($subscription->refresh()->status)->toBe('frozen');
});

test('overdue unpaid subscriptions stop after the plan allowance window', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['access_grace_days' => 3]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
        'start_date' => '2026-07-01',
    ]);
    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '100.00',
        'due_date' => '2026-07-01',
    ]);

    $count = app(StopOverdueUnpaidSubscriptions::class)->handle(Carbon::parse('2026-07-05'));

    expect($count)->toBe(1)
        ->and($subscription->refresh()->status)->toBe('stopped');
});

test('overdue unpaid subscriptions stay active during the plan allowance window', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['access_grace_days' => 3]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
        'start_date' => '2026-07-01',
    ]);
    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '100.00',
        'due_date' => '2026-07-01',
    ]);

    $count = app(StopOverdueUnpaidSubscriptions::class)->handle(Carbon::parse('2026-07-04'));

    expect($count)->toBe(0)
        ->and($subscription->refresh()->status)->toBe('active');
});

test('paid subscriptions are not stopped by overdue unpaid automation', function (): void {
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['access_grace_days' => 3]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
        'start_date' => '2026-07-01',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'due_date' => '2026-07-01',
    ]);

    $count = app(StopOverdueUnpaidSubscriptions::class)->handle(Carbon::parse('2026-07-10'));

    expect($count)->toBe(0)
        ->and($subscription->refresh()->status)->toBe('active');
});
