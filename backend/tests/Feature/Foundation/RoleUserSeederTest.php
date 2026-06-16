<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\RoleMatrixSeeder;
use Database\Seeders\RoleUserSeeder;

test('seeder creates one user for each preset role', function (): void {
    $this->seed(RoleMatrixSeeder::class);
    $this->seed(RoleUserSeeder::class);

    foreach (FoundationPermissions::ALL_ROLES as $roleName) {
        $user = User::where('email', strtolower($roleName).'@gym.test')->first();

        expect($user)->not->toBeNull()
            ->and($user->name)->toBe("{$roleName} User")
            ->and($user->hasRole($roleName))->toBeTrue();
    }
});

test('seeder is idempotent and does not create duplicate role users', function (): void {
    $this->seed(RoleMatrixSeeder::class);
    $this->seed(RoleUserSeeder::class);
    $this->seed(RoleUserSeeder::class);

    foreach (FoundationPermissions::ALL_ROLES as $roleName) {
        expect(User::where('email', strtolower($roleName).'@gym.test')->count())->toBe(1);
    }
});
