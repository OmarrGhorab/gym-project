<?php

use App\Actions\Reports\FinancialReport;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionRefund;
use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('admin can cancel within grace with full refund by default', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
        'cancellation_grace_days' => 2,
    ]);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'price_paid' => '300.00',
        'cancellation_grace_days' => 2,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-10 10:00:00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel", [])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'stopped')
        ->assertJsonPath('data.can_cancel_with_refund', false)
        ->assertJsonPath('data.paid_total', '0.00')
        ->assertJsonPath('data.end_date', '2026-06-10')
        ->assertJsonPath('data.days_left', null)
        ->assertJsonPath('data.billing_status', 'refunded')
        ->assertJsonPath('data.refund_total', '300.00');

    expect(SubscriptionRefund::query()->where('subscription_id', $subscription->id)->count())->toBe(1)
        ->and((string) SubscriptionRefund::query()->first()->amount)->toBe('300.00')
        ->and($subscription->fresh()->end_date->toDateString())->toBe('2026-06-10');

    $refundPayment = Payment::query()
        ->where('payable_type', Subscription::class)
        ->where('payable_id', $subscription->id)
        ->where('status', 'refunded')
        ->first();

    expect($refundPayment)->not->toBeNull()
        ->and((string) $refundPayment->amount)->toBe('-300.00');

    $netRevenue = (float) Payment::query()
        ->whereIn('status', Payment::REVENUE_STATUSES)
        ->sum('amount');

    expect($netRevenue)->toBe(0.0);
});

test('admin can cancel with custom lower refund amount', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create(['cancellation_grace_days' => 2]);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'price_paid' => '500.00',
        'cancellation_grace_days' => 2,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '500.00',
        'method' => 'card',
        'status' => 'paid',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel", [
        'refund_amount' => '200.00',
        'method' => 'card',
        'reason' => 'Partial goodwill refund',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'stopped');

    $refund = SubscriptionRefund::query()->first();
    expect((string) $refund->amount)->toBe('200.00')
        ->and($refund->method)->toBe('card')
        ->and($refund->reason)->toBe('Partial goodwill refund');
});

test('cancel with refund is blocked after grace period', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create(['cancellation_grace_days' => 2]);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'price_paid' => '300.00',
        'cancellation_grace_days' => 2,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    // Grace ends 2026-06-02; today is 2026-06-10
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel", [])
        ->assertStatus(422);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/stop")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'stopped');

    expect(SubscriptionRefund::count())->toBe(0);
});

test('cancel rejects refund amount above paid total', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create(['cancellation_grace_days' => 5]);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'price_paid' => '100.00',
        'cancellation_grace_days' => 5,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '100.00',
        'status' => 'paid',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel", [
        'refund_amount' => '150.00',
    ])->assertStatus(422);
});

test('cancel with full refund reduces financial report revenue', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
        'cancellation_grace_days' => 2,
    ]);
    $member = Member::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'price_paid' => '300.00',
        'cancellation_grace_days' => 2,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
        'status' => 'paid',
        'paid_at' => '2026-06-10 10:00:00',
    ]);

    $before = app(FinancialReport::class)->execute([
        'from' => '2026-06-01',
        'to' => '2026-06-30',
        'group_by' => 'month',
        'revenue_source' => 'subscriptions',
    ]);
    expect($before['meta']['totals']['revenue'])->toBe('300.00');

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel", [])
        ->assertStatus(200);

    $after = app(FinancialReport::class)->execute([
        'from' => '2026-06-01',
        'to' => '2026-06-30',
        'group_by' => 'month',
        'revenue_source' => 'subscriptions',
    ]);
    expect($after['meta']['totals']['revenue'])->toBe('0.00');
});

test('admin cancellation dispatches operational notification with refund amount, staff actor, and days in plan', function (): void {
    Notification::fake();

    $user = User::factory()->create(['name' => 'Admin Staff']);
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create([
        'name' => 'VIP Monthly',
        'cancellation_grace_days' => 5,
    ]);
    $member = Member::factory()->active()->create(['name' => 'John Doe']);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-08',
        'price_paid' => '500.00',
        'cancellation_grace_days' => 5,
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '500.00',
        'status' => 'paid',
    ]);

    // TestNow is set to '2026-06-10' in beforeEach, so start date June 8 to June 10 = 3 days in plan
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/cancel", [
        'refund_amount' => '400.00',
    ])->assertStatus(200);

    Notification::assertSentTo(
        [$user],
        OperationalNotification::class,
        function (OperationalNotification $notification) use ($subscription, $user): bool {
            $data = $notification->toArray($user);

            return $data['category'] === 'membership.cancelled_refund'
                && $data['subscription_id'] === $subscription->id
                && $data['member_name'] === 'John Doe'
                && $data['plan_name'] === 'VIP Monthly'
                && $data['refund_amount'] === '400.00'
                && $data['cancelled_by'] === $user->id
                && $data['cancelled_by_name'] === 'Admin Staff'
                && $data['days_in_plan'] === 3
                && str_contains((string) $data['body'], 'John Doe cancelled VIP Monthly after 3 day(s) in plan — refund EGP 400.00 by Admin Staff.');
        }
    );
});
