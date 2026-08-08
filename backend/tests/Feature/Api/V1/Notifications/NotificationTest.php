<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
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

    $this->patchJson("/api/v1/notifications/{$notification->id}/read")
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

    $this->patchJson("/api/v1/notifications/{$notification->id}/read")
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});

test('user without notifications view permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/notifications')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('notification index rejects invalid unread filter', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/notifications?unread=definitely')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('subscription notification stored before the message fields existed is filled in on read', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create([
        'name' => 'هادي محمد السعيد',
        'attendance_code' => 'M-QF3GYC',
    ]);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => Plan::factory()->active()->create(['name' => 'Gold'])->id,
        'start_date' => '2026-06-06',
        'end_date' => '2026-09-06',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '600.00',
        'status' => 'paid',
    ]);

    // Exactly the shape the production rows had: no start_date, amount_paid or code.
    $user->notifications()->delete();
    $user->notify(new SubscriptionRenewalReminder([
        'subscription_id' => $subscription->id,
        'category' => 'membership.subscription_created',
        'member_name' => 'هادي محمد السعيد',
        'end_date' => '2026-09-06',
    ]));

    $data = $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->json('data.0.data');

    expect($data['start_date'])->toBe('2026-06-06')
        ->and($data['amount_paid'])->toBe('600.00')
        ->and($data['attendance_code'])->toBe('M-QF3GYC')
        ->and($data['attendance_qr'])->toBe('member:M-QF3GYC')
        // Stored values still win, so a historical notification keeps its dates.
        ->and($data['end_date'])->toBe('2026-09-06');
});

test('read path always returns the current attendance code, not the stored one', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create(['attendance_code' => 'M-NEWCOD']);
    $subscription = Subscription::factory()->for($member)->active()->create([
        'plan_id' => Plan::factory()->active()->create()->id,
    ]);

    // A code frozen before the shorten-codes migration would no longer scan.
    $user->notifications()->delete();
    $user->notify(new SubscriptionRenewalReminder([
        'subscription_id' => $subscription->id,
        'attendance_code' => 'M-OLD16CHARCODEXX',
        'attendance_qr' => 'member:M-OLD16CHARCODEXX',
    ]));

    $data = $this->getJson('/api/v1/notifications')->assertOk()->json('data.0.data');

    expect($data['attendance_code'])->toBe('M-NEWCOD')
        ->and($data['attendance_qr'])->toBe('member:M-NEWCOD');
});
