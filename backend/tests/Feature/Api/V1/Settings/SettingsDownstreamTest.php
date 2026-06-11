<?php

use App\Actions\Reminders\FindExpiringSubscriptions;
use App\Actions\Settings\StoreSetting;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('downstream subscription reminders consume updated reminder_days', function (): void {
    // Create a member and a plan
    $member = Member::factory()->create();
    $plan = Plan::factory()->create();

    // Create subscription ending in 5 days
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'active',
        'start_date' => Carbon::today()->subDays(25),
        'end_date' => Carbon::today()->addDays(5),
    ]);

    $storeAction = new StoreSetting;
    $findAction = new FindExpiringSubscriptions;

    // Case 1: reminder_days is 3 -> subscription ending in 5 days should NOT be found
    $storeAction->execute('reminder_days', 3);
    $expiring = $findAction->handle();
    expect($expiring->pluck('id'))->not->toContain($subscription->id);

    // Case 2: reminder_days is 7 -> subscription ending in 5 days SHOULD be found
    $storeAction->execute('reminder_days', 7);
    $expiring = $findAction->handle();
    expect($expiring->pluck('id'))->toContain($subscription->id);
});
