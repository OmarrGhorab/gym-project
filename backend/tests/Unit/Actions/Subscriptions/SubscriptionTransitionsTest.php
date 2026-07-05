<?php

use App\Actions\Subscriptions\StopSubscription;
use App\Actions\Subscriptions\UnfreezeSubscription;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

test('unfreeze resumes from selected date with the saved remaining days', function (): void {
    $subscription = Subscription::factory()->frozen()->create([
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

    $unfrozen = app(UnfreezeSubscription::class)->handle($subscription, [
        'resume_on' => '2026-07-09',
    ]);

    expect($unfrozen->status)->toBe('active')
        ->and($unfrozen->end_date->toDateString())->toBe('2026-07-27')
        ->and($unfrozen->freezes->first()->days)->toBe(4)
        ->and($unfrozen->freezes->first()->resumed_on->toDateString())->toBe('2026-07-09');
});

test('unfreeze without resume date uses today', function (): void {
    Carbon::setTestNow('2026-07-09');

    $subscription = Subscription::factory()->frozen()->create([
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

    $unfrozen = app(UnfreezeSubscription::class)->handle($subscription);

    expect($unfrozen->end_date->toDateString())->toBe('2026-07-27');

    Carbon::setTestNow();
});

test('unfreeze rejects non frozen subscriptions', function (): void {
    $subscription = Subscription::factory()->active()->create();

    expect(fn () => app(UnfreezeSubscription::class)->handle($subscription))
        ->toThrow(ValidationException::class);
});

test('stop transitions active subscription to stopped', function (): void {
    $subscription = Subscription::factory()->active()->create();

    $stopped = app(StopSubscription::class)->handle($subscription);

    expect($stopped->status)->toBe('stopped');
});

test('stop rejects expired subscription', function (): void {
    $subscription = Subscription::factory()->expired()->create();

    expect(fn () => app(StopSubscription::class)->handle($subscription))
        ->toThrow(ValidationException::class);
});
