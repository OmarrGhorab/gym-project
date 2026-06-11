<?php

use App\Actions\Subscriptions\StopSubscription;
use App\Actions\Subscriptions\UnfreezeSubscription;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

test('unfreeze returns a frozen subscription to active without changing end date', function (): void {
    $subscription = Subscription::factory()->frozen()->create([
        'end_date' => '2026-07-03',
    ]);

    $unfrozen = app(UnfreezeSubscription::class)->handle($subscription);

    expect($unfrozen->status)->toBe('active')
        ->and($unfrozen->end_date->toDateString())->toBe('2026-07-03');
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
