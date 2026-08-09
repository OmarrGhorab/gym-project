<?php

use App\Actions\WhatsApp\SendMemberMessage;
use App\Jobs\SendWhatsAppMessageJob;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Setting;
use App\Models\Subscription;
use App\Models\WhatsAppMessage;
use App\Support\WhatsAppTemplates;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Queue::fake();

    // The env-level kill switch and gateway credentials. Off by default
    // everywhere, so each test opts in explicitly.
    config()->set('services.whatsapp.enabled', true);
    config()->set('services.whatsapp.url', 'http://127.0.0.1:3001');
    config()->set('services.whatsapp.token', 'test-token');
});

/** @param array<string, bool>|null $events */
function enableWhatsAppEvents(?array $events = null, bool $master = true): void
{
    Setting::updateOrCreate(['key' => 'whatsapp.auto_send'], ['value' => $master]);
    Setting::updateOrCreate(['key' => 'whatsapp.auto_events'], [
        'value' => $events ?? array_fill_keys(WhatsAppTemplates::keys(), true),
    ]);

    // SendMemberMessage reads settings through the shared 'settings.all' cache.
    Cache::forget('settings.all');
}

/**
 * A subscription created without firing SubscriptionObserver.
 *
 * The observer defers its work to DB::afterCommit, which never runs inside
 * RefreshDatabase's transaction. Suppressing events keeps that irrelevant and
 * makes each test drive the action directly, which is what is under test here.
 *
 * @param  array<string, mixed>  $memberAttributes
 * @param  array<string, mixed>  $subscriptionAttributes
 */
function whatsappSubscription(array $memberAttributes = [], array $subscriptionAttributes = []): Subscription
{
    $member = Member::factory()->active()->create(array_merge([
        'name' => 'Omar',
        'phone' => '01012345678',
        'attendance_code' => 'M-ABC234',
    ], $memberAttributes));

    $plan = Plan::factory()->active()->create(['name' => 'Gold']);

    return Subscription::withoutEvents(fn (): Subscription => Subscription::factory()->active()->create(array_merge([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ], $subscriptionAttributes)));
}

test('queues a confirmation with the rendered body and the entry barcode', function (): void {
    enableWhatsAppEvents();
    $subscription = whatsappSubscription();

    $message = app(SendMemberMessage::class)
        ->handle($subscription, WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION);

    expect($message)->not->toBeNull()
        ->and($message->status)->toBe(WhatsAppMessage::STATUS_PENDING)
        ->and($message->phone)->toBe('201012345678')
        ->and($message->member_id)->toBe($subscription->member_id)
        ->and($message->body)->toContain('Omar')
        ->and($message->body)->not->toContain('{{')
        // The barcode also rides along as an image, so the member has something
        // scannable in the chat rather than a link to open at the door.
        ->and($message->image_url)->toBe('https://barcodeapi.org/api/128/M-ABC234');

    Queue::assertPushed(SendWhatsAppMessageJob::class, fn (SendWhatsAppMessageJob $job): bool => $job->messageId === $message->id);
});

test('sends nothing when the environment kill switch is off', function (): void {
    enableWhatsAppEvents();
    config()->set('services.whatsapp.enabled', false);

    $message = app(SendMemberMessage::class)
        ->handle(whatsappSubscription(), WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION);

    expect($message)->toBeNull();
    expect(WhatsAppMessage::count())->toBe(0);
    Queue::assertNothingPushed();
});

test('sends nothing when the gateway is not configured', function (): void {
    enableWhatsAppEvents();
    config()->set('services.whatsapp.token', null);

    expect(app(SendMemberMessage::class)->handle(whatsappSubscription(), WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION))
        ->toBeNull();
    expect(WhatsAppMessage::count())->toBe(0);
});

test('sends nothing when the gym master toggle is off', function (): void {
    enableWhatsAppEvents(master: false);

    expect(app(SendMemberMessage::class)->handle(whatsappSubscription(), WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION))
        ->toBeNull();
    expect(WhatsAppMessage::count())->toBe(0);
});

test('sends nothing for an event the gym has switched off', function (): void {
    enableWhatsAppEvents([WhatsAppTemplates::EXPIRY_REMINDER => true]);

    expect(app(SendMemberMessage::class)->handle(whatsappSubscription(), WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION))
        ->toBeNull();
    expect(WhatsAppMessage::count())->toBe(0);
});

test('defaults every event to off when the gym has saved no toggles', function (): void {
    // No settings rows at all — a fresh install must not message anybody.
    Cache::forget('settings.all');

    expect(app(SendMemberMessage::class)->handle(whatsappSubscription(), WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION))
        ->toBeNull();
    expect(WhatsAppMessage::count())->toBe(0);
});

/**
 * The low-sessions trigger fires on every check-in once the count drops to two,
 * and the expiry trigger fires once per configured reminder day. Without this
 * the member is messaged repeatedly.
 */
test('never queues the same message twice for one subscription', function (): void {
    enableWhatsAppEvents();
    $subscription = whatsappSubscription();
    $action = app(SendMemberMessage::class);

    $first = $action->handle($subscription, WhatsAppTemplates::LOW_SESSIONS_REMINDER);
    $second = $action->handle($subscription, WhatsAppTemplates::LOW_SESSIONS_REMINDER);

    expect($first)->not->toBeNull()
        ->and($second)->toBeNull()
        ->and(WhatsAppMessage::count())->toBe(1);

    Queue::assertPushed(SendWhatsAppMessageJob::class, 1);
});

test('still queues a different message for the same subscription', function (): void {
    enableWhatsAppEvents();
    $subscription = whatsappSubscription();
    $action = app(SendMemberMessage::class);

    $action->handle($subscription, WhatsAppTemplates::LOW_SESSIONS_REMINDER);
    $action->handle($subscription, WhatsAppTemplates::SESSIONS_FINISHED_REMINDER);

    expect(WhatsAppMessage::count())->toBe(2);
});

test('retries a previously failed message on a later trigger', function (): void {
    enableWhatsAppEvents();
    $subscription = whatsappSubscription();
    $action = app(SendMemberMessage::class);

    $first = $action->handle($subscription, WhatsAppTemplates::EXPIRY_REMINDER);
    $first->update(['status' => WhatsAppMessage::STATUS_FAILED, 'error' => 'temporary']);

    // A failure may have been a wrong number that staff have since corrected,
    // so a failed row must not block the next attempt forever.
    expect($action->handle($subscription, WhatsAppTemplates::EXPIRY_REMINDER))->not->toBeNull();
    expect(WhatsAppMessage::count())->toBe(2);
});

test('records a failure instead of queueing when the member has no phone', function (): void {
    enableWhatsAppEvents();
    $subscription = whatsappSubscription(['phone' => '']);

    $message = app(SendMemberMessage::class)
        ->handle($subscription, WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION);

    expect($message->status)->toBe(WhatsAppMessage::STATUS_FAILED)
        ->and($message->error)->toBe('Member has no phone number.');

    Queue::assertNothingPushed();
});

test('omits the image when the template asks for no barcode', function (): void {
    enableWhatsAppEvents();

    $message = app(SendMemberMessage::class)
        ->handle(whatsappSubscription(), WhatsAppTemplates::EXPIRY_REMINDER);

    expect($message->image_url)->toBeNull();
});

test('uses the template the gym edited in settings', function (): void {
    enableWhatsAppEvents();
    Setting::updateOrCreate(['key' => 'whatsapp.templates'], [
        'value' => [WhatsAppTemplates::EXPIRY_REMINDER => 'Ya {{member_name}}, {{plan_name}} khalas.'],
    ]);
    Cache::forget('settings.all');

    $message = app(SendMemberMessage::class)
        ->handle(whatsappSubscription(), WhatsAppTemplates::EXPIRY_REMINDER);

    expect($message->body)->toBe('Ya Omar, Gold khalas.');
});

test('greets a first time member and welcomes back a renewing one', function (): void {
    $action = app(SendMemberMessage::class);

    $first = whatsappSubscription();
    expect($action->confirmationKeyFor($first))->toBe(WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION);

    $renewal = Subscription::withoutEvents(fn (): Subscription => Subscription::factory()->active()->create([
        'member_id' => $first->member_id,
        'plan_id' => $first->plan_id,
    ]));

    expect($action->confirmationKeyFor($renewal))->toBe(WhatsAppTemplates::RENEWAL_CONFIRMATION);
});
