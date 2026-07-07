<?php

namespace Database\Seeders;

use App\Models\Member;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RemoveDemoMembersSeeder extends Seeder
{
    /**
     * Remove only seeded demo members and their dependent subscription records.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $demoMemberIds = Member::query()
                ->where(function ($query): void {
                    $query
                        ->where('email', 'like', 'demo.seed.member.%@gym.test')
                        ->orWhere('email', 'like', 'demo.member.%@gym.test')
                        ->orWhere('email', 'like', 'demo.member.%')
                        ->orWhere('name', 'like', 'Seed Member%')
                        ->orWhere('name', 'like', 'Demo Member%');
                })
                ->pluck('id');

            if ($demoMemberIds->isEmpty()) {
                return;
            }

            $subscriptionIds = Subscription::query()
                ->whereIn('member_id', $demoMemberIds)
                ->pluck('id');

            if ($subscriptionIds->isNotEmpty()) {
                Payment::query()
                    ->where('payable_type', Subscription::class)
                    ->whereIn('payable_id', $subscriptionIds)
                    ->delete();

                SubscriptionFreeze::query()
                    ->whereIn('subscription_id', $subscriptionIds)
                    ->delete();

                Subscription::query()
                    ->whereIn('id', $subscriptionIds)
                    ->delete();
            }

            Member::query()
                ->whereIn('id', $demoMemberIds)
                ->delete();
        });
    }
}
