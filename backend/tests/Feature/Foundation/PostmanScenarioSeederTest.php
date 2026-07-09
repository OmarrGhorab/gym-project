<?php

use App\Models\Employee;
use App\Models\Member;
use App\Models\Plan;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\DatabaseSeeder;
use Spatie\Permission\Models\Role;

test('database seeder seeds access roles and staff without operational demo data', function (): void {
    $this->seed(DatabaseSeeder::class);

    $admin = User::where('email', 'admin@gym.test')->firstOrFail();
    $manager = User::where('email', 'manager@gym.test')->firstOrFail();

    expect($admin->hasRole(FoundationPermissions::ROLE_ADMIN))->toBeTrue()
        ->and($manager->hasRole(FoundationPermissions::ROLE_MANAGER))->toBeTrue()
        ->and(Role::where('name', FoundationPermissions::ROLE_ADMIN)->exists())->toBeTrue()
        ->and(User::where('email', 'frontdesk@gym.test')->exists())->toBeTrue()
        ->and(Employee::where('phone', 'like', '+2010111100%')->count())->toBe(13)
        ->and(Member::count())->toBe(0)
        ->and(Plan::count())->toBe(0);
});
