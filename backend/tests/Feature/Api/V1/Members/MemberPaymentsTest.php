<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\MembershipPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('admin can fetch member payments and receives paginated envelope', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
        );
});

test('member payments returns payments for only that members subscriptions', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $otherMember = Member::factory()->create();
    $plan = Plan::factory()->active()->create();

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    $otherSubscription = Subscription::factory()->active()->create([
        'member_id' => $otherMember->id,
        'plan_id' => $plan->id,
    ]);

    $payment = Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '125.50',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $otherSubscription->id,
        'amount' => '999.00',
    ]);

    $response = $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(200)
        ->assertJsonPath('data.0.id', $payment->id)
        ->assertJsonPath('data.0.amount', '125.50')
        ->assertJsonPath('meta.total', 1);

    expect(collect($response->json('data'))->pluck('id')->all())->toBe([$payment->id]);
});

test('member payments returns empty collection when no payments exist', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $response = $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(200);

    $data = $response->json('data');
    expect($data)->toBeArray()->toBeEmpty();
});

test('member payments returns 404 for non-existent member', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/members/9999/payments')
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});

test('unauthenticated request receives 401', function (): void {
    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without payments.view permission receives 403', function (): void {
    // Captain role has only subscriptions.view — no payments.view
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('user with payments view but without members view cannot fetch member payments', function (): void {
    $user = User::factory()->create();
    $user->givePermissionTo(MembershipPermissions::PERM_PAYMENTS_VIEW);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('accountant with payments.view can fetch member payments', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(200);
});
