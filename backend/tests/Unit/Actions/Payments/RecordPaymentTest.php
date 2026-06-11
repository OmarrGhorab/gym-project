<?php

use App\Actions\Payments\RecordPayment;
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

function makePaymentSubscription(array $subscriptionOverrides = [], array $planOverrides = []): Subscription
{
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(array_merge([
        'price' => '300.00',
    ], $planOverrides));

    return Subscription::factory()->active()->create(array_merge([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
        'discount' => '0.00',
    ], $subscriptionOverrides));
}

test('record payment marks partial payment when balance remains', function (): void {
    $user = User::factory()->create();
    $subscription = makePaymentSubscription();

    $payment = app(RecordPayment::class)->handle($subscription, [
        'amount' => '100.00',
        'method' => 'cash',
    ], $user);

    expect($payment->status)->toBe('partial')
        ->and($payment->amount)->toBe('100.00')
        ->and($payment->created_by)->toBe($user->id);
});

test('record payment marks paid when full balance is cleared', function (): void {
    $subscription = makePaymentSubscription();

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '100.00',
    ]);

    $payment = app(RecordPayment::class)->handle($subscription, [
        'amount' => '200.00',
        'method' => 'cash',
    ]);

    expect($payment->status)->toBe('paid')
        ->and(Payment::where('payable_id', $subscription->id)->count())->toBe(2);
});

test('record payment rejects overpayment', function (): void {
    $subscription = makePaymentSubscription();

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '250.00',
    ]);

    expect(fn () => app(RecordPayment::class)->handle($subscription, [
        'amount' => '60.00',
        'method' => 'cash',
    ]))->toThrow(ValidationException::class);
});

test('record payment rejects settled subscriptions', function (): void {
    $subscription = makePaymentSubscription();

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    expect(fn () => app(RecordPayment::class)->handle($subscription, [
        'amount' => '10.00',
        'method' => 'cash',
    ]))->toThrow(ValidationException::class);
});

test('record payment re-reads locked subscription payments before accepting a stale request', function (): void {
    $subscription = makePaymentSubscription([
        'price_paid' => '300.00',
    ]);

    $staleSubscription = Subscription::query()->findOrFail($subscription->id);

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '250.00',
    ]);

    expect(fn () => app(RecordPayment::class)->handle($staleSubscription, [
        'amount' => '60.00',
        'method' => 'cash',
    ]))->toThrow(ValidationException::class)
        ->and(Payment::where('payable_id', $subscription->id)->count())->toBe(1);
});
