<?php

use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('creating a subscription freeze creates an audit log entry', function (): void {
    $user = User::factory()->create();
    $subscription = Subscription::factory()->active()->create();

    $freeze = SubscriptionFreeze::create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-06-11',
        'freeze_end' => '2026-06-15',
        'days' => 4,
        'reason' => 'Medical',
        'created_by' => $user->id,
    ]);

    $this->assertDatabaseHas('activity_log', [
        'subject_type' => SubscriptionFreeze::class,
        'subject_id' => $freeze->id,
        'log_name' => 'subscription_freeze',
    ]);
});
