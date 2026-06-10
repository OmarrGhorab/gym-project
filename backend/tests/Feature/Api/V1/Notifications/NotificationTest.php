<?php

use App\Models\User;
use App\Notifications\SubscriptionRenewalReminder;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('user can list own notifications with unread filter', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $user->notify(new SubscriptionRenewalReminder([
        'subscription_id' => 1,
        'member_name' => 'Sara',
        'end_date' => '2026-06-15',
    ]));

    $user->notify(new SubscriptionRenewalReminder([
        'subscription_id' => 2,
        'member_name' => 'Omar',
        'end_date' => '2026-06-16',
    ]));

    $read = $user->notifications()->latest()->first();

    $user->notifications()->whereKey($read->id)->update(['read_at' => now()]);

    $this->getJson('/api/v1/notifications?unread=true')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');
});

test('user can mark own notification as read', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $user->notify(new SubscriptionRenewalReminder([
        'subscription_id' => 1,
        'member_name' => 'Sara',
        'end_date' => '2026-06-15',
    ]));

    $notification = $user->notifications()->latest()->first();

    $this->postJson("/api/v1/notifications/{$notification->id}/read")
        ->assertStatus(200)
        ->assertJsonPath('data.id', $notification->id);
});

test('user cannot mark another users notification as read', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $other = User::factory()->create();
    $other->notify(new SubscriptionRenewalReminder([
        'subscription_id' => 1,
        'member_name' => 'Sara',
        'end_date' => '2026-06-15',
    ]));

    $notification = $other->notifications()->latest()->first();

    $this->postJson("/api/v1/notifications/{$notification->id}/read")
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});
