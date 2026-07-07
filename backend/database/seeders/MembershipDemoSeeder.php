<?php

namespace Database\Seeders;

use App\Models\Member;
use App\Models\Payment;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;

/**
 * Creates a compact membership demo dataset for testing membership dashboards.
 *
 * The seeder owns records with emails demo.seed.member.*@gym.test, so it can
 * be re-run without deleting manually-created members.
 */
class MembershipDemoSeeder extends Seeder
{
    private const MEMBER_COUNT = 100;

    public function run(): void
    {
        $seller = $this->seller();
        $coaches = $this->coaches();
        $plans = $this->plans();

        if ($plans->isEmpty()) {
            $this->call(PlanSeeder::class);
            $plans = $this->plans();
        }

        if ($plans->isEmpty()) {
            return;
        }

        $this->clearExistingDemoSubscriptions();

        for ($index = 1; $index <= self::MEMBER_COUNT; $index++) {
            $member = $this->member($index, $seller, $coaches);
            $plan = $plans[($index - 1) % $plans->count()];
            $subscription = $this->subscription($member, $plan, $seller, $index);

            $this->payment($subscription, $seller, $index);

            if ($subscription->status === 'frozen') {
                $this->freeze($subscription, $seller, $index);
            }
        }
    }

    private function seller(): User
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'admin@gym.test'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ],
        );

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return $user;
    }

    /**
     * @return Collection<int, Employee>
     */
    private function coaches(): Collection
    {
        return Employee::query()
            ->where('status', 'active')
            ->whereIn('role', ['coach', 'captain'])
            ->orderBy('id')
            ->get();
    }

    /**
     * @return Collection<int, Plan>
     */
    private function plans()
    {
        return Plan::query()
            ->where('is_active', true)
            ->orderBy('type')
            ->orderBy('name')
            ->get();
    }

    private function clearExistingDemoSubscriptions(): void
    {
        $memberIds = Member::query()
            ->where('email', 'like', 'demo.seed.member.%@gym.test')
            ->pluck('id');

        if ($memberIds->isEmpty()) {
            return;
        }

        $subscriptionIds = Subscription::query()
            ->whereIn('member_id', $memberIds)
            ->pluck('id');

        if ($subscriptionIds->isNotEmpty()) {
            Payment::query()
                ->where('payable_type', Subscription::class)
                ->whereIn('payable_id', $subscriptionIds)
                ->delete();

            Subscription::query()
                ->whereIn('id', $subscriptionIds)
                ->delete();
        }
    }

    private function member(int $index, User $seller, Collection $coaches): Member
    {
        $padded = str_pad((string) $index, 3, '0', STR_PAD_LEFT);
        $joinDate = Carbon::today()
            ->subMonthsNoOverflow(($index - 1) % 10)
            ->subDays(($index * 2) % 21);
        $coachId = $coaches->isNotEmpty() ? $coaches[$index % $coaches->count()]->id : null;

        return Member::query()->updateOrCreate(
            ['email' => "demo.seed.member.{$padded}@gym.test"],
            [
                'name' => "Seed Member {$padded}",
                'phone' => '+20160'.str_pad((string) $index, 8, '0', STR_PAD_LEFT),
                'gender' => ['male', 'female', null][$index % 3],
                'national_id' => str_pad((string) (38800000000000 + $index), 14, '0', STR_PAD_LEFT),
                'birth_date' => Carbon::today()->subYears(18 + ($index % 32))->subDays($index)->toDateString(),
                'join_date' => $joinDate->toDateString(),
                'status' => $index > 90 ? 'inactive' : 'active',
                'notes' => $index % 10 === 0 ? 'Seed demo member for subscription testing.' : null,
                'goals' => ['fat_loss', 'strength', 'mobility', 'general_fitness'][$index % 4],
                'injuries' => $index % 13 === 0 ? 'Old shoulder injury' : null,
                'medical_notes' => $index % 17 === 0 ? 'Needs low-impact cardio.' : null,
                'tags' => [$index % 2 === 0 ? 'evening' : 'morning', $index % 5 === 0 ? 'vip' : 'standard'],
                'coach_id' => $coachId,
                'created_by' => $seller->id,
            ],
        );
    }

    private function subscription(Member $member, Plan $plan, User $seller, int $index): Subscription
    {
        [$status, $startDate, $endDate] = $this->subscriptionWindow($plan, $index);
        $discount = $index % 12 === 0 ? min(250, (float) $plan->price * 0.10) : 0;
        $pricePaid = max(0, (float) $plan->price - $discount);
        $sessions = $plan->is_unlimited_sessions || $plan->sessions_count === null
            ? null
            : (int) $plan->sessions_count;

        return Subscription::query()->create([
            'member_id' => $member->id,
            'plan_id' => $plan->id,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'status' => $status,
            'price_paid' => number_format($pricePaid, 2, '.', ''),
            'discount' => number_format($discount, 2, '.', ''),
            'sessions_total' => $sessions,
            'sessions_remaining' => $sessions === null ? null : max(0, $sessions - ($index % max(1, $sessions))),
            'sold_by_user_id' => $seller->id,
            'created_by' => $seller->id,
            'last_reminded_on' => $index % 8 === 0 ? Carbon::today()->subDays(2)->toDateString() : null,
        ]);
    }

    /**
     * @return array{0: string, 1: Carbon, 2: Carbon}
     */
    private function subscriptionWindow(Plan $plan, int $index): array
    {
        $status = match (true) {
            $index <= 70 => 'active',
            $index <= 80 => 'active',
            $index <= 88 => 'expired',
            $index <= 94 => 'frozen',
            default => 'stopped',
        };

        if ($index <= 70) {
            $startDate = Carbon::today()->subDays(5 + ($index % 50));
            $endDate = $plan->endDateFrom($startDate);

            if ($endDate->lt(Carbon::today())) {
                $startDate = Carbon::today()->subDays($index % 12);
                $endDate = $plan->endDateFrom($startDate);
            }

            return [$status, $startDate, $endDate];
        }

        if ($index <= 80) {
            $endDate = Carbon::today()->addDays($index % 7);
            $startDate = $endDate->copy()->subDays(max(1, (int) $plan->duration_days));

            return [$status, $startDate, $endDate];
        }

        if ($index <= 88) {
            $endDate = Carbon::today()->subDays(2 + ($index % 16));
            $startDate = $endDate->copy()->subDays(max(1, (int) $plan->duration_days));

            return [$status, $startDate, $endDate];
        }

        if ($index <= 94) {
            $startDate = Carbon::today()->subDays(15 + ($index % 10));
            $endDate = Carbon::today()->addDays(10 + ($index % 20));

            return [$status, $startDate, $endDate];
        }

        $endDate = Carbon::today()->subDays(1 + ($index % 10));
        $startDate = $endDate->copy()->subDays(max(1, (int) $plan->duration_days));

        return [$status, $startDate, $endDate];
    }

    private function payment(Subscription $subscription, User $seller, int $index): void
    {
        $price = (float) $subscription->price_paid;
        $amount = match (true) {
            $index % 11 === 0 => 0,
            $index % 7 === 0 => round($price * 0.5, 2),
            default => $price,
        };

        Payment::query()->create([
            'payable_type' => Subscription::class,
            'payable_id' => $subscription->id,
            'amount' => number_format($amount, 2, '.', ''),
            'method' => ['cash', 'card', 'bank_transfer', 'wallet'][$index % 4],
            'status' => $amount <= 0 ? 'due' : ($amount < $price ? 'partial' : 'paid'),
            'paid_at' => $amount > 0 ? Carbon::parse($subscription->start_date)->addHours(10 + ($index % 10)) : null,
            'due_date' => $amount < $price ? Carbon::parse($subscription->start_date)->addDays(3)->toDateString() : null,
            'created_by' => $seller->id,
        ]);
    }

    private function freeze(Subscription $subscription, User $seller, int $index): void
    {
        $freezeStart = Carbon::today()->subDays(1 + ($index % 3));
        $freezeEnd = Carbon::today()->addDays(3 + ($index % 5));

        SubscriptionFreeze::query()->create([
            'subscription_id' => $subscription->id,
            'freeze_start' => $freezeStart->toDateString(),
            'freeze_end' => $freezeEnd->toDateString(),
            'days' => (int) $freezeStart->diffInDays($freezeEnd) + 1,
            'remaining_days_at_freeze' => max(0, (int) $freezeStart->diffInDays($subscription->end_date, false)),
            'reason' => 'Seed demo freeze window.',
            'created_by' => $seller->id,
        ]);
    }
}
