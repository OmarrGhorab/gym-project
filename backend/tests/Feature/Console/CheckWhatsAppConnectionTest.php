<?php

use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);

    config()->set('services.whatsapp.url', 'http://127.0.0.1:3001');
    config()->set('services.whatsapp.token', 'test-token');

    Cache::flush();
    Carbon::setTestNow('2026-08-15 19:00:00');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function whatsappAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    return $admin;
}

/**
 * One stub whose answer can change between runs.
 *
 * Http::fake() stacks its stubs and the first match wins, so re-faking the same
 * URL mid-test would silently keep answering with the original state — and a
 * watchdog that is only ever shown one state is not being tested at all.
 */
function fakeGateway(): object
{
    $gateway = new class
    {
        /** @var array<string, mixed> */
        public array $status = [
            'state' => 'connected',
            'connected' => true,
            'number' => '201000319756',
            'error' => null,
            'queued' => 0,
        ];

        /** @param array<string, mixed> $status */
        public function reports(array $status): void
        {
            $this->status = [...$this->status, ...$status];
        }

        public function isDown(string $state, ?string $error = null, int $queued = 0): void
        {
            $this->reports([
                'state' => $state,
                'connected' => false,
                'number' => null,
                'error' => $error,
                'queued' => $queued,
            ]);
        }
    };

    Http::fake(['*/status' => fn () => Http::response($gateway->status)]);

    return $gateway;
}

/** @return array<string, mixed> */
function notificationData(OperationalNotification $notification, User $user): array
{
    return $notification->toArray($user);
}

/**
 * The number being unlinked is the one fault nothing recovers from on its own,
 * so it is worth telling people about the moment it is seen rather than after a
 * grace period that cannot change the answer.
 */
test('it tells the admins to send by hand as soon as the number is unlinked', function (): void {
    Notification::fake();
    $admin = whatsappAdmin();

    fakeGateway()->isDown('logged_out', 'Stream Errored (conflict)', queued: 4);

    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertSentTo($admin, OperationalNotification::class, function ($notification) use ($admin) {
        $data = notificationData($notification, $admin);

        return $data['category'] === 'whatsapp.link_lost'
            && $data['connection_state'] === 'logged_out'
            && $data['connection_error'] === 'Stream Errored (conflict)'
            && $data['queued'] === 4
            && str_contains($data['body'], 'by hand');
    });
});

test('it does not alert while the gateway is still reconnecting on its own', function (): void {
    Notification::fake();
    whatsappAdmin();

    fakeGateway()->isDown('disconnected');

    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertNothingSent();
});

test('it alerts once a drop outlasts the grace period', function (): void {
    Notification::fake();
    $admin = whatsappAdmin();

    fakeGateway()->isDown('disconnected');

    $this->artisan('whatsapp:check-connection')->assertSuccessful();
    Notification::assertNothingSent();

    Carbon::setTestNow('2026-08-15 19:20:00');
    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertSentTo($admin, OperationalNotification::class);
});

/**
 * A five-minute schedule must not put the same unchanged fault in the bell
 * twelve times an hour, or the bell stops meaning anything.
 */
test('it does not repeat an unchanged fault on every run', function (): void {
    Notification::fake();
    $admin = whatsappAdmin();

    fakeGateway()->isDown('logged_out');

    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Carbon::setTestNow('2026-08-15 19:05:00');
    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertSentToTimes($admin, OperationalNotification::class, 1);
});

/** What the admin has to do changed, so the notification is worth repeating. */
test('it alerts again when the fault changes into a different one', function (): void {
    Notification::fake();
    $admin = whatsappAdmin();
    $gateway = fakeGateway();

    $gateway->isDown('unreachable');
    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Carbon::setTestNow('2026-08-15 19:20:00');
    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Carbon::setTestNow('2026-08-15 19:25:00');
    $gateway->isDown('logged_out');
    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertSentToTimes($admin, OperationalNotification::class, 2);
});

test('it says so when the number is linked again', function (): void {
    Notification::fake();
    $admin = whatsappAdmin();
    $gateway = fakeGateway();

    $gateway->isDown('logged_out');
    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    $gateway->reports(['state' => 'connected', 'connected' => true, 'number' => '201000319756']);
    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertSentTo($admin, OperationalNotification::class, function ($notification) use ($admin) {
        return notificationData($notification, $admin)['category'] === 'whatsapp.link_restored';
    });
});

/** Recovery is only news to someone who was told it broke. */
test('it stays quiet for a healthy connection that was never broken', function (): void {
    Notification::fake();
    whatsappAdmin();

    fakeGateway();

    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertNothingSent();
});

/** A gym that never set WhatsApp up is not broken. */
test('it stays quiet when the service is not configured', function (): void {
    Notification::fake();
    whatsappAdmin();

    config()->set('services.whatsapp.url', null);
    Http::fake();

    $this->artisan('whatsapp:check-connection')->assertSuccessful();

    Notification::assertNothingSent();
});
