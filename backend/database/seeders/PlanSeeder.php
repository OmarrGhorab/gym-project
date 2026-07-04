<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Seed the gym's default membership and session plans.
 *
 * These plans are idempotent (matched by name) so they can be safely re-run
 * without creating duplicates.
 */
class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Monthly Gym Access',
                'description' => 'Unlimited gym access for one month.',
                'price' => 650.00,
                'duration_days' => 30,
                'sessions_count' => null,
                'is_unlimited_sessions' => true,
                'type' => 'membership',
                'category' => 'gym_access',
                'is_active' => true,
                'max_freeze_days' => 5,
                'min_freeze_days' => 1,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.0800,
            ],
            [
                'name' => 'Premium Monthly',
                'description' => 'Unlimited gym access plus group classes for one month.',
                'price' => 950.00,
                'duration_days' => 30,
                'sessions_count' => null,
                'is_unlimited_sessions' => true,
                'type' => 'membership',
                'category' => 'classes',
                'is_active' => true,
                'max_freeze_days' => 7,
                'min_freeze_days' => 1,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.1000,
            ],
            [
                'name' => 'Quarterly Transformation',
                'description' => 'Three months of unlimited access with freeze flexibility.',
                'price' => 3600.00,
                'duration_days' => 90,
                'sessions_count' => null,
                'is_unlimited_sessions' => true,
                'type' => 'membership',
                'category' => 'gym_access',
                'is_active' => true,
                'max_freeze_days' => 14,
                'min_freeze_days' => 3,
                'freeze_requires_approval' => true,
                'commission_rate' => 0.1200,
            ],
            [
                'name' => 'Yearly VIP',
                'description' => 'Best-value annual membership with unlimited access and PT sessions.',
                'price' => 12000.00,
                'duration_days' => 365,
                'sessions_count' => 96,
                'is_unlimited_sessions' => false,
                'type' => 'membership',
                'category' => 'personal_training',
                'is_active' => true,
                'max_freeze_days' => 30,
                'min_freeze_days' => 7,
                'freeze_requires_approval' => true,
                'commission_rate' => 0.1500,
            ],
            [
                'name' => 'Student Off-Peak',
                'description' => 'Discounted weekday morning and afternoon access for students.',
                'price' => 420.00,
                'duration_days' => 30,
                'sessions_count' => null,
                'is_unlimited_sessions' => true,
                'type' => 'offer',
                'category' => 'gym_access',
                'is_active' => true,
                'access_starts_at' => '07:00',
                'access_ends_at' => '16:00',
                'max_freeze_days' => 3,
                'min_freeze_days' => 1,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.0500,
            ],
            [
                'name' => 'Corporate Plan',
                'description' => 'Group membership rate for corporate partners.',
                'price' => 950.00,
                'duration_days' => 30,
                'sessions_count' => null,
                'is_unlimited_sessions' => true,
                'type' => 'membership',
                'category' => 'gym_access',
                'is_active' => true,
                'max_freeze_days' => 5,
                'min_freeze_days' => 1,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.1000,
            ],
            [
                'name' => '8 Personal Training Sessions',
                'description' => 'One-month personal training package with 8 sessions.',
                'price' => 1800.00,
                'duration_days' => 30,
                'sessions_count' => 8,
                'is_unlimited_sessions' => false,
                'type' => 'offer',
                'category' => 'personal_training',
                'is_active' => true,
                'max_freeze_days' => 0,
                'min_freeze_days' => 0,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.1200,
            ],
            [
                'name' => '12 Personal Training Sessions',
                'description' => 'Personal training package with 12 sessions over 45 days.',
                'price' => 2500.00,
                'duration_days' => 45,
                'sessions_count' => 12,
                'is_unlimited_sessions' => false,
                'type' => 'offer',
                'category' => 'personal_training',
                'is_active' => true,
                'max_freeze_days' => 0,
                'min_freeze_days' => 0,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.1400,
            ],
            [
                'name' => 'Weekend Warrior',
                'description' => 'Friday to Sunday unlimited access for one month.',
                'price' => 520.00,
                'duration_days' => 30,
                'sessions_count' => null,
                'is_unlimited_sessions' => true,
                'type' => 'offer',
                'category' => 'gym_access',
                'is_active' => true,
                'max_freeze_days' => 2,
                'min_freeze_days' => 1,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.0500,
            ],
            [
                'name' => 'Day Pass',
                'description' => 'Single-day gym access.',
                'price' => 100.00,
                'duration_days' => 1,
                'sessions_count' => null,
                'is_unlimited_sessions' => true,
                'type' => 'offer',
                'category' => 'gym_access',
                'is_active' => true,
                'max_freeze_days' => 0,
                'min_freeze_days' => 0,
                'freeze_requires_approval' => false,
                'commission_rate' => 0.0000,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::query()->updateOrCreate(
                ['name' => $plan['name']],
                $plan,
            );
        }
    }
}
