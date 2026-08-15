<?php

use App\Models\Setting;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\WhatsAppTemplates;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

function actingAsSettingsAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    return $admin;
}

test('admin can switch automatic whatsapp sending on per event', function (): void {
    actingAsSettingsAdmin();

    $this->putJson('/api/v1/settings', [
        'whatsapp' => [
            'auto_send' => true,
            'auto_events' => [
                WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION => true,
                WhatsAppTemplates::EXPIRY_REMINDER => false,
            ],
        ],
    ])->assertStatus(200)
        ->assertJsonPath('data.whatsapp.auto_send', true)
        ->assertJsonPath('data.whatsapp.auto_events.'.WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION, true)
        ->assertJsonPath('data.whatsapp.auto_events.'.WhatsAppTemplates::EXPIRY_REMINDER, false);

    expect(Setting::where('key', 'whatsapp.auto_send')->value('value'))->toBeTrue();
});

/**
 * The stored value decides whether real members are messaged, so anything the
 * sender would not recognise must not reach the settings table.
 */
test('discards an unknown event key', function (): void {
    actingAsSettingsAdmin();

    $this->putJson('/api/v1/settings', [
        'whatsapp' => [
            'auto_send' => true,
            'auto_events' => [
                WhatsAppTemplates::EXPIRY_REMINDER => true,
                'blast_everyone' => true,
            ],
        ],
    ])->assertStatus(200);

    expect(Setting::where('key', 'whatsapp.auto_events')->value('value'))
        ->toBe([WhatsAppTemplates::EXPIRY_REMINDER => true]);
});

test('stores toggles as real booleans', function (): void {
    actingAsSettingsAdmin();

    $this->putJson('/api/v1/settings', [
        'whatsapp' => [
            'auto_send' => '1',
            'auto_events' => [WhatsAppTemplates::EXPIRY_REMINDER => '0'],
        ],
    ])->assertStatus(200)
        ->assertJsonPath('data.whatsapp.auto_events.'.WhatsAppTemplates::EXPIRY_REMINDER, false);

    expect(Setting::where('key', 'whatsapp.auto_events')->value('value'))
        ->toBe([WhatsAppTemplates::EXPIRY_REMINDER => false]);
});

test('reports every event as off on a fresh install', function (): void {
    actingAsSettingsAdmin();

    $response = $this->getJson('/api/v1/settings')->assertStatus(200);

    expect($response->json('data.whatsapp.auto_send'))->toBeFalse();

    foreach (WhatsAppTemplates::keys() as $key) {
        expect($response->json("data.whatsapp.auto_events.{$key}"))->toBeFalse();
    }
});

test('editing templates leaves the toggles untouched', function (): void {
    actingAsSettingsAdmin();

    $this->putJson('/api/v1/settings', [
        'whatsapp' => ['auto_send' => true, 'auto_events' => [WhatsAppTemplates::EXPIRY_REMINDER => true]],
    ])->assertStatus(200);

    $this->putJson('/api/v1/settings', [
        'whatsapp' => ['templates' => [WhatsAppTemplates::EXPIRY_REMINDER => 'New text']],
    ])->assertStatus(200)
        ->assertJsonPath('data.whatsapp.auto_send', true)
        ->assertJsonPath('data.whatsapp.auto_events.'.WhatsAppTemplates::EXPIRY_REMINDER, true)
        ->assertJsonPath('data.whatsapp.templates.'.WhatsAppTemplates::EXPIRY_REMINDER, 'New text');
});

test('connection status reports an unconfigured gateway rather than failing', function (): void {
    actingAsSettingsAdmin();
    config()->set('services.whatsapp.url', null);
    config()->set('services.whatsapp.token', null);

    $this->getJson('/api/v1/settings/whatsapp/connection')
        ->assertStatus(200)
        ->assertJsonPath('data.configured', false)
        ->assertJsonPath('data.enabled', false)
        ->assertJsonPath('data.connected', false)
        ->assertJsonPath('data.state', 'not_configured');
});

test('connection status reports the linked number', function (): void {
    actingAsSettingsAdmin();
    config()->set('services.whatsapp.enabled', true);
    config()->set('services.whatsapp.url', 'http://127.0.0.1:3001');
    config()->set('services.whatsapp.token', 'test-token');
    Http::fake(['*/status' => Http::response([
        'state' => 'connected',
        'connected' => true,
        'number' => '201012345678',
        'error' => null,
        'queued' => 3,
    ])]);

    $this->getJson('/api/v1/settings/whatsapp/connection')
        ->assertStatus(200)
        ->assertJsonPath('data.connected', true)
        ->assertJsonPath('data.number', '201012345678')
        ->assertJsonPath('data.queued', 3);
});

/**
 * The pairing QR links a device to the gym's WhatsApp account, so whoever can
 * read it can read the gym's conversations.
 */
test('staff without settings permission cannot reach the pairing qr', function (): void {
    Sanctum::actingAs(User::factory()->create());

    $this->getJson('/api/v1/settings/whatsapp/qr')->assertStatus(403);
    $this->getJson('/api/v1/settings/whatsapp/connection')->assertStatus(403);
    $this->postJson('/api/v1/settings/whatsapp/logout')->assertStatus(403);
    $this->postJson('/api/v1/settings/whatsapp/reconnect')->assertStatus(403);
});

/**
 * Recovering a session another process took over must not cost anyone a trip to
 * the gym's phone: the pairing is still good, only the socket needs rebuilding.
 */
test('an admin can rebuild the session without unlinking the number', function (): void {
    actingAsSettingsAdmin();
    config()->set('services.whatsapp.url', 'http://127.0.0.1:3001');
    config()->set('services.whatsapp.token', 'test-token');
    Http::fake([
        '*/reconnect' => Http::response(['ok' => true]),
        '*/status' => Http::response([
            'state' => 'connected',
            'connected' => true,
            'number' => '201012345678',
            'error' => null,
            'queued' => 0,
        ]),
    ]);

    $this->postJson('/api/v1/settings/whatsapp/reconnect')
        ->assertStatus(200)
        ->assertJsonPath('data.state', 'connected');

    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/reconnect') && $request->method() === 'POST');
});

test('reconnect reports the service being down rather than pretending it worked', function (): void {
    actingAsSettingsAdmin();
    config()->set('services.whatsapp.url', 'http://127.0.0.1:3001');
    config()->set('services.whatsapp.token', 'test-token');
    Http::fake(['*/reconnect' => fn () => throw new ConnectionException('Connection refused')]);

    $this->postJson('/api/v1/settings/whatsapp/reconnect')
        ->assertStatus(503)
        ->assertJsonPath('error.code', 'whatsapp_unreachable');
});

test('the pairing qr requires authentication', function (): void {
    $this->getJson('/api/v1/settings/whatsapp/qr')->assertStatus(401);
});
