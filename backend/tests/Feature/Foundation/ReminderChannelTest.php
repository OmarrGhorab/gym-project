<?php

use App\Jobs\SendRenewalReminderJob;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\SubscriptionRenewalReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow('2026-06-10');
    Notification::fake();
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('reminder job still delivers database notification when messaging provider is unconfigured', function (): void {
    Config::set('services.messaging.driver', null);

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'sold_by_user_id' => $seller->id,
        'end_date' => '2026-06-15',
        'last_reminded_on' => null,
    ]);

    (new SendRenewalReminderJob($subscription->id))->handle();

    Notification::assertSentTo($seller, SubscriptionRenewalReminder::class);

    $subscription->refresh();
    expect($subscription->last_reminded_on?->toDateString())->toBe('2026-06-10');
});
