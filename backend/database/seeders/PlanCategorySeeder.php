<?php

namespace Database\Seeders;

use App\Models\PlanCategory;
use Illuminate\Database\Seeder;

final class PlanCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Gym access', 'slug' => 'gym_access', 'description' => 'Standard gym floor and equipment access'],
            ['name' => 'Personal training', 'slug' => 'personal_training', 'description' => '1-on-1 personal coaching sessions'],
            ['name' => 'Classes', 'slug' => 'classes', 'description' => 'Group fitness classes'],
            ['name' => 'Fitness Studio', 'slug' => 'fitness_studio', 'description' => 'Specialized studio classes (Jiu-Jitsu, Martial Arts, Yoga) without gym floor access'],
            ['name' => 'Jiu-Jitsu', 'slug' => 'jiu_jitsu', 'description' => 'Brazilian Jiu-Jitsu and martial arts training'],
            ['name' => 'Nutrition', 'slug' => 'nutrition', 'description' => 'Dietary and meal planning add-ons'],
            ['name' => 'Recovery', 'slug' => 'recovery', 'description' => 'Sauna, ice bath, and recovery zone access'],
        ];

        foreach ($categories as $cat) {
            PlanCategory::query()->firstOrCreate(
                ['slug' => $cat['slug']],
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'is_active' => true,
                ]
            );
        }
    }
}
