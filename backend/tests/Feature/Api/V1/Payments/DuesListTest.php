<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
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

test('dues list returns subscriptions with outstanding balances only', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $dueSubscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
    ]);

    $paidSubscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
    ]);

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $dueSubscription->id,
        'amount' => '100.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $paidSubscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    $response = $this->getJson('/api/v1/payments?status=due')
        ->assertStatus(200);

    $ids = collect($response->json('data'))->pluck('subscription.id')->all();

    expect($ids)->toContain($dueSubscription->id)
        ->not->toContain($paidSubscription->id);
});
