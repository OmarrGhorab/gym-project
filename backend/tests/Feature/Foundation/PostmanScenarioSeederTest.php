<?php

use App\Models\Employee;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\GymStaffSeeder;
use Spatie\Permission\Models\Role;

test('database seeder seeds access roles, staff logins and the starter catalog', function (): void {
    $this->seed(DatabaseSeeder::class);

    $admin = User::where('email', 'admin@gym.test')->firstOrFail();
    $manager = User::where('email', 'manager@gym.test')->firstOrFail();
    $deskCashier = User::where('email', 'morning.cashier1@gym.test')->firstOrFail();

    expect($admin->hasRole(FoundationPermissions::ROLE_ADMIN))->toBeTrue()
        ->and($manager->hasRole(FoundationPermissions::ROLE_MANAGER))->toBeTrue()
        ->and($deskCashier->hasRole(FoundationPermissions::ROLE_CASHIER))->toBeTrue()
        ->and(Role::where('name', FoundationPermissions::ROLE_ADMIN)->exists())->toBeTrue()
        ->and(Employee::count())->toBe(count(GymStaffSeeder::staffRecords()));

    // The root seeder is the full local-testing seed: cashiers need a catalog and
    // members to sell/renew subscriptions and POS against.
    expect(Plan::count())->toBeGreaterThan(0)
        ->and(Product::count())->toBeGreaterThan(0)
        ->and(Member::count())->toBeGreaterThan(0);
});

test('database seeder is idempotent', function (): void {
    $this->seed(DatabaseSeeder::class);

    $employees = Employee::count();
    $members = Member::count();
    $plans = Plan::count();

    $this->seed(DatabaseSeeder::class);

    expect(Employee::count())->toBe($employees)
        ->and(Member::count())->toBe($members)
        ->and(Plan::count())->toBe($plans)
        ->and(User::where('email', 'morning.cashier1@gym.test')->count())->toBe(1);
});
