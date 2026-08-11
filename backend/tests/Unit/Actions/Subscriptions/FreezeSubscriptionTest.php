<?php

use App\Actions\Subscriptions\FreezeSubscription;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('freeze subscription creates freeze row and preserves end date until resume', function (): void {
    $user = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'max_freeze_days' => 10,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-30',
    ]);

    $frozen = app(FreezeSubscription::class)->handle($subscription, [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
        'reason' => 'travel',
    ], $user);

    expect($frozen->status)->toBe('frozen')
        ->and($frozen->end_date->toDateString())->toBe('2026-06-30');

    $freeze = SubscriptionFreeze::first();
    expect($freeze)->not->toBeNull()
        ->and($freeze->days)->toBe(3)
        ->and($freeze->remaining_days_at_freeze)->toBe(20)
        ->and($freeze->created_by)->toBe($user->id);
});

test('freeze subscription rejects when cumulative freeze exceeds plan cap', function (): void {
    $user = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'max_freeze_days' => 5,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    SubscriptionFreeze::create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-06-01',
        'freeze_end' => '2026-06-03',
        'days' => 3,
        'reason' => 'prior freeze',
        'created_by' => $user->id,
    ]);

    expect(fn () => app(FreezeSubscription::class)->handle($subscription, [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
        'reason' => 'travel',
    ], $user))->toThrow(ValidationException::class);
});

test('freeze subscription on an approval-only plan is blocked without the approval permission', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'max_freeze_days' => 10,
        'freeze_requires_approval' => true,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-30',
    ]);

    expect(fn () => app(FreezeSubscription::class)->handle($subscription, [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
    ], $user))->toThrow(ValidationException::class)
        ->and(SubscriptionFreeze::count())->toBe(0);
});

test('freeze subscription on an approval-only plan records the approver', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'max_freeze_days' => 10,
        'freeze_requires_approval' => true,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-30',
    ]);

    $frozen = app(FreezeSubscription::class)->handle($subscription, [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
    ], $user);

    $freeze = SubscriptionFreeze::firstOrFail();

    expect($frozen->status)->toBe('frozen')
        ->and($freeze->approved_by)->toBe($user->id)
        ->and($freeze->approved_at)->not->toBeNull();
});

test('freeze subscription leaves the approver empty when the plan needs no approval', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'max_freeze_days' => 10,
        'freeze_requires_approval' => false,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-30',
    ]);

    app(FreezeSubscription::class)->handle($subscription, [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
    ], $user);

    expect(SubscriptionFreeze::firstOrFail()->approved_by)->toBeNull();
});

test('freeze subscription rejects invalid status', function (): void {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->stopped()->create();

    expect(fn () => app(FreezeSubscription::class)->handle($subscription, [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
    ], $user))->toThrow(ValidationException::class);
});

test('freeze subscription re-reads locked freeze totals before accepting a stale request', function (): void {
    $user = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'max_freeze_days' => 5,
    ]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-30',
    ]);

    $staleSubscription = Subscription::query()->findOrFail($subscription->id);

    app(FreezeSubscription::class)->handle($subscription, [
        'freeze_start' => '2026-06-01',
        'freeze_end' => '2026-06-03',
        'reason' => 'first freeze',
    ], $user);

    $subscription->refresh()->update(['status' => 'active']);

    expect(fn () => app(FreezeSubscription::class)->handle($staleSubscription, [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
        'reason' => 'stale second freeze',
    ], $user))->toThrow(ValidationException::class)
        ->and(SubscriptionFreeze::where('subscription_id', $subscription->id)->count())->toBe(1);
});
