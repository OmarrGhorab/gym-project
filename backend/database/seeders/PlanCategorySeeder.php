<?php

namespace Database\Seeders;

use App\Models\PlanCategory;
use Illuminate\Database\Seeder;

/**
 * Starter categories. Every plan type gets at least one, so no type opens the plan
 * form with an empty category picker — admins can rename or retire these and add
 * their own from Plans → Categories.
 */
final class PlanCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            // membership
            [
                'name' => 'Gym access',
                'slug' => 'gym_access',
                'plan_type' => 'membership',
                'description' => 'Standard gym floor and equipment access',
                'is_system' => true,
            ],
            // offer
            [
                'name' => 'Promotion',
                'slug' => 'promotion',
                'plan_type' => 'offer',
                'description' => 'Time-limited promotional pricing',
                'is_system' => false,
            ],
            // offer_package
            [
                'name' => 'Bundle',
                'slug' => 'bundle',
                'plan_type' => 'offer_package',
                'description' => 'Membership bundled with included services',
                'is_system' => false,
            ],
            // fitness_studio
            [
                'name' => 'Fitness Studio',
                'slug' => 'fitness_studio',
                'plan_type' => 'fitness_studio',
                'description' => 'Specialized studio classes (Martial Arts, Yoga) without gym floor access',
                'is_system' => true,
            ],
            [
                'name' => 'Jiu-Jitsu',
                'slug' => 'jiu_jitsu',
                'plan_type' => 'fitness_studio',
                'description' => 'Brazilian Jiu-Jitsu and martial arts training',
                'is_system' => false,
            ],
            // extra_service
            [
                'name' => 'Personal training',
                'slug' => 'personal_training',
                'plan_type' => 'extra_service',
                'description' => '1-on-1 personal coaching sessions',
                'is_system' => false,
            ],
            [
                'name' => 'Classes',
                'slug' => 'classes',
                'plan_type' => 'extra_service',
                'description' => 'Group fitness classes',
                'is_system' => false,
            ],
            [
                'name' => 'Nutrition',
                'slug' => 'nutrition',
                'plan_type' => 'extra_service',
                'description' => 'Dietary and meal planning add-ons',
                'is_system' => false,
            ],
            [
                'name' => 'Recovery',
                'slug' => 'recovery',
                'plan_type' => 'extra_service',
                'description' => 'Sauna, ice bath, and recovery zone access',
                'is_system' => false,
            ],
            // membership_extra_service
            [
                'name' => 'Membership + coaching',
                'slug' => 'membership_coaching',
                'plan_type' => 'membership_extra_service',
                'description' => 'Gym access sold together with a coaching service',
                'is_system' => false,
            ],
        ];

        foreach ($categories as $category) {
            PlanCategory::query()->firstOrCreate(
                ['slug' => $category['slug']],
                [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'plan_type' => $category['plan_type'],
                    'is_system' => $category['is_system'],
                    'is_active' => true,
                ]
            );
        }
    }
}
