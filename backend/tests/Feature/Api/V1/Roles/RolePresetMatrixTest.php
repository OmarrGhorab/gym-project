<?php

use App\Support\FoundationPermissions;
use App\Support\PermissionMatrix;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('preset roles contain exact seeded permissions', function (): void {
    $admin = Role::findByName(FoundationPermissions::ROLE_ADMIN, 'web');
    $manager = Role::findByName(FoundationPermissions::ROLE_MANAGER, 'web');
    $cashier = Role::findByName(FoundationPermissions::ROLE_CASHIER, 'web');
    $captain = Role::findByName(FoundationPermissions::ROLE_CAPTAIN, 'web');
    $accountant = Role::findByName(FoundationPermissions::ROLE_ACCOUNTANT, 'web');

    // Admin has everything
    expect($admin->permissions->pluck('name')->toArray())->toHaveCount(count(PermissionMatrix::all()));

    // Manager permissions check
    expect($manager->hasPermissionTo('settings.manage'))->toBeFalse();
    expect($manager->hasPermissionTo('roles.manage'))->toBeFalse();
    expect($manager->hasPermissionTo('members.view'))->toBeTrue();
    expect($manager->hasPermissionTo('export.members'))->toBeTrue();

    // Cashier permissions check
    expect($cashier->hasPermissionTo('members.view'))->toBeTrue();
    expect($cashier->hasPermissionTo('members.create'))->toBeTrue();
    expect($cashier->hasPermissionTo('members.delete'))->toBeFalse();
    expect($cashier->hasPermissionTo('export.members'))->toBeTrue();
    expect($cashier->hasPermissionTo('export.payroll'))->toBeFalse();

    // Captain permissions check
    expect($captain->hasPermissionTo('commissions.view'))->toBeTrue();
    expect($captain->hasPermissionTo('members.view'))->toBeTrue();
    expect($captain->hasPermissionTo('members.create'))->toBeFalse();
    expect($captain->hasPermissionTo('export.members'))->toBeTrue();

    // Accountant permissions check
    expect($accountant->hasPermissionTo('payroll.view'))->toBeTrue();
    expect($accountant->hasPermissionTo('payroll.generate'))->toBeFalse();
    expect($accountant->hasPermissionTo('export.payroll'))->toBeTrue();
    expect($accountant->hasPermissionTo('export.members'))->toBeFalse();
});
