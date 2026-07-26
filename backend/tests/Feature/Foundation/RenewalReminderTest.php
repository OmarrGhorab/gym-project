<?php

use App\Actions\Reminders\SendRenewalReminders;
use App\Jobs\SendRenewalReminderJob;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Setting;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow('2026-06-10');
    Queue::fake();
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('renewal reminders dispatch only for in window active subscriptions and are idempotent per day', function (): void {
    Setting::create([
        'key' => 'reminder_days',
        'value' => 7,
    ]);

    $plan = Plan::factory()->active()->create();

    // Each scenario needs its own member: a member holding a later active
    // subscription is treated as already renewed and is intentionally skipped
    // by the reminder finder (Subscription::scopeWithoutLaterActiveRenewal).
    $inWindow = Subscription::factory()->active()->create([
        'member_id' => Member::factory()->active()->create()->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-15',
        'last_reminded_on' => null,
    ]);

    $outsideWindow = Subscription::factory()->active()->create([
        'member_id' => Member::factory()->active()->create()->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-30',
        'last_reminded_on' => null,
    ]);

    $alreadyReminded = Subscription::factory()->active()->create([
        'member_id' => Member::factory()->active()->create()->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-14',
        'last_reminded_on' => '2026-06-10',
    ]);

    $count = app(SendRenewalReminders::class)->handle();

    expect($count)->toBe(1);

    Queue::assertPushed(SendRenewalReminderJob::class, function (SendRenewalReminderJob $job) use ($inWindow): bool {
        return $job->subscriptionId === $inWindow->id;
    });

    Queue::assertNotPushed(SendRenewalReminderJob::class, function (SendRenewalReminderJob $job) use ($outsideWindow): bool {
        return $job->subscriptionId === $outsideWindow->id;
    });

    Queue::assertNotPushed(SendRenewalReminderJob::class, function (SendRenewalReminderJob $job) use ($alreadyReminded): bool {
        return $job->subscriptionId === $alreadyReminded->id;
    });

    app(SendRenewalReminders::class)->handle();

    Queue::assertPushed(SendRenewalReminderJob::class, 1);
});
