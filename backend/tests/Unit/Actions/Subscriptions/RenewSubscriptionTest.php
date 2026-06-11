<?php

use App\Actions\Subscriptions\RenewSubscription;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('renew subscription starts the day after an unexpired subscription ends', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $source = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($renewed->id)->not->toBe($source->id)
        ->and($renewed->start_date->toDateString())->toBe('2026-07-01')
        ->and($renewed->end_date->toDateString())->toBe('2026-07-31');
});

test('renew subscription starts today when the source subscription is already expired', function (): void {
    Carbon::setTestNow('2026-06-10');

    $seller = User::factory()->create();
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $source = Subscription::factory()->expired()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-04-01',
        'end_date' => '2026-05-01',
        'price_paid' => '300.00',
    ]);

    $renewed = app(RenewSubscription::class)->handle($source, [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ], $seller);

    expect($renewed->start_date->toDateString())->toBe('2026-06-10')
        ->and($renewed->end_date->toDateString())->toBe('2026-07-10')
        ->and(Subscription::count())->toBe(2);
});
