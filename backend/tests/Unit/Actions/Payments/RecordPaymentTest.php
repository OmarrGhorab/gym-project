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

test('record payment keeps an overpayment as money and leaves the period alone', function (): void {
    // Paying above the balance means the gym took more money. It does not mean
    // the member bought more time — nobody asked for that here.
    $subscription = makePaymentSubscription([
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '250.00',
    ]);

    $payment = app(RecordPayment::class)->handle($subscription, [
        'amount' => '60.00',
        'method' => 'cash',
    ]);

    expect($payment->status)->toBe('paid')
        ->and($payment->amount)->toBe('60.00')
        ->and($subscription->fresh()->end_date->toDateString())->toBe('2026-07-31');
});

test('record payment turns an overpayment into days when the desk asks for it', function (): void {
    $subscription = makePaymentSubscription([
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '250.00',
    ]);

    // 250.00 already paid + 60.00 now = 310.00 against 300.00. The 10.00 excess
    // buys 1 day at the 300.00 / 30-day rate.
    $payment = app(RecordPayment::class)->handle($subscription, [
        'amount' => '60.00',
        'method' => 'cash',
        'extend_days_for_overpayment' => true,
    ]);

    expect($payment->status)->toBe('paid')
        ->and($subscription->fresh()->end_date->toDateString())->toBe('2026-08-01');
});

test('record payment on a settled subscription can buy a further period of days', function (): void {
    $subscription = makePaymentSubscription([
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    $payment = app(RecordPayment::class)->handle($subscription, [
        'amount' => '150.00',
        'method' => 'cash',
        'extend_days_for_overpayment' => true,
    ]);

    expect($payment->status)->toBe('paid')
        ->and($subscription->fresh()->end_date->toDateString())->toBe('2026-08-15');
});

test('a settled subscription paid again without asking for days keeps its end date', function (): void {
    $subscription = makePaymentSubscription([
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    app(RecordPayment::class)->handle($subscription, [
        'amount' => '150.00',
        'method' => 'cash',
    ]);

    expect($subscription->fresh()->end_date->toDateString())->toBe('2026-07-31');
});

test('a zero-value subscription refuses to convert money into days', function (): void {
    // No daily rate means the excess cannot be turned into service. It is only
    // an error because the desk explicitly asked for days.
    $subscription = makePaymentSubscription(['price_paid' => '0.00']);

    expect(fn () => app(RecordPayment::class)->handle($subscription, [
        'amount' => '60.00',
        'method' => 'cash',
        'extend_days_for_overpayment' => true,
    ]))->toThrow(Illuminate\Validation\ValidationException::class);
});

test('record payment re-reads locked subscription payments before accepting a stale request', function (): void {
    $subscription = makePaymentSubscription([
        'price_paid' => '300.00',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    $staleSubscription = Subscription::query()->findOrFail($subscription->id);

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '250.00',
    ]);

    app(RecordPayment::class)->handle($staleSubscription, [
        'amount' => '60.00',
        'method' => 'cash',
        'extend_days_for_overpayment' => true,
    ]);

    expect(Payment::where('payable_id', $subscription->id)->count())->toBe(2)
        ->and($subscription->fresh()->end_date->toDateString())->toBe('2026-08-01');
});
