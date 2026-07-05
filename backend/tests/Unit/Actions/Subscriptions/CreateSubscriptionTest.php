<?php

use App\Actions\Subscriptions\CreateSubscription;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('create subscription derives end date and creates linked payment', function (): void {
    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $subscription = app(CreateSubscription::class)->handle([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'discount' => '50.00',
        'payment' => [
            'amount' => '150.00',
            'method' => 'cash',
            'paid_at' => '2026-06-10 10:00:00',
        ],
    ], $seller);

    expect($subscription)
        ->toBeInstanceOf(Subscription::class)
        ->and($subscription->status)->toBe('active')
        ->and($subscription->start_date->toDateString())->toBe('2026-06-10')
        ->and($subscription->end_date->toDateString())->toBe('2026-07-10')
        ->and($subscription->price_paid)->toBe('250.00')
        ->and($subscription->discount)->toBe('50.00')
        ->and($subscription->sold_by_user_id)->toBe($seller->id);

    $payment = Payment::first();

    expect($payment)
        ->not->toBeNull()
        ->and($payment->payable_type)->toBe(Subscription::class)
        ->and($payment->payable_id)->toBe($subscription->id)
        ->and($payment->amount)->toBe('150.00')
        ->and($payment->status)->toBe('partial')
        ->and($payment->created_by)->toBe($seller->id);
});

test('create subscription prices multiple cycles from custom end date', function (): void {
    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $subscription = app(CreateSubscription::class)->handle([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-09-08',
        'discount' => '50.00',
        'payment' => [
            'amount' => '850.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($subscription)
        ->toBeInstanceOf(Subscription::class)
        ->and($subscription->end_date->toDateString())->toBe('2026-09-08')
        ->and($subscription->price_paid)->toBe('850.00')
        ->and($subscription->payments()->first()?->amount)->toBe('850.00')
        ->and($subscription->payments()->first()?->status)->toBe('paid');
});

test('create subscription derives end date from plan duration months', function (): void {
    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
        'duration_months' => 1,
    ]);

    $subscription = app(CreateSubscription::class)->handle([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-01-31',
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($subscription)
        ->toBeInstanceOf(Subscription::class)
        ->and($subscription->start_date->toDateString())->toBe('2026-01-31')
        ->and($subscription->end_date->toDateString())->toBe('2026-02-28');
});

test('create subscription rejects inactive member', function (): void {
    $seller = User::factory()->create();
    $member = Member::factory()->inactive()->create();
    $plan = Plan::factory()->active()->create();

    expect(fn () => app(CreateSubscription::class)->handle([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ], $seller))->toThrow(ValidationException::class);
});

test('create subscription rejects unsellable plan', function (): void {
    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->inactive()->create();

    expect(fn () => app(CreateSubscription::class)->handle([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ], $seller))->toThrow(ValidationException::class);
});
