<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\MoneyPermissions;
use App\Support\PermissionMatrix;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('every money permission is registered in the catalog', function (): void {
    expect(PermissionMatrix::all())->toContain(...MoneyPermissions::ALL_PERMISSIONS);
});

test('money permissions group under their own module', function (): void {
    expect(PermissionMatrix::grouped())
        ->toHaveKey('money')
        ->and(PermissionMatrix::grouped()['money'])
        ->toEqualCanonicalizing(MoneyPermissions::ALL_PERMISSIONS);
});

test('admin holds every money permission', function (): void {
    $admin = Role::findByName(FoundationPermissions::ROLE_ADMIN, 'web');

    foreach (MoneyPermissions::ALL_PERMISSIONS as $permission) {
        expect($admin->hasPermissionTo($permission))->toBeTrue();
    }
});

test('no other preset role holds any money permission', function (string $roleName): void {
    $role = Role::findByName($roleName, 'web');

    foreach (MoneyPermissions::ALL_PERMISSIONS as $permission) {
        expect($role->hasPermissionTo($permission))->toBeFalse();
    }
})->with([
    FoundationPermissions::ROLE_MANAGER,
    FoundationPermissions::ROLE_CASHIER,
    FoundationPermissions::ROLE_CAPTAIN,
    FoundationPermissions::ROLE_ACCOUNTANT,
]);

test('holding a resource view permission does not imply seeing its money', function (): void {
    $accountant = Role::findByName(FoundationPermissions::ROLE_ACCOUNTANT, 'web');

    // The accountant reads payroll and reports but sees no figures until an
    // administrator grants the matching money permission.
    expect($accountant->hasPermissionTo('payroll.view'))->toBeTrue()
        ->and($accountant->hasPermissionTo(MoneyPermissions::PERM_MONEY_PAYROLL_VIEW))->toBeFalse()
        ->and($accountant->hasPermissionTo('reports.view'))->toBeTrue()
        ->and($accountant->hasPermissionTo(MoneyPermissions::PERM_MONEY_REPORTS_VIEW))->toBeFalse();
});

test('money permissions can be granted to a role without widening anything else', function (): void {
    $role = Role::create(['name' => 'Finance Viewer', 'guard_name' => 'web']);
    $role->syncPermissions(['payroll.view', MoneyPermissions::PERM_MONEY_PAYROLL_VIEW]);

    expect($role->hasPermissionTo(MoneyPermissions::PERM_MONEY_PAYROLL_VIEW))->toBeTrue()
        ->and($role->hasPermissionTo(MoneyPermissions::PERM_MONEY_REPORTS_VIEW))->toBeFalse()
        ->and($role->hasPermissionTo('payroll.pay'))->toBeFalse();
});

test('money permissions are exposed to the dashboard through the permissions catalog', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/permissions')
        ->assertStatus(200)
        ->assertJsonPath('data.money', MoneyPermissions::ALL_PERMISSIONS);
});

test('current user payload carries money permissions for the frontend to gate on', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/auth/me')
        ->assertStatus(200)
        ->assertJson(fn ($json) => $json->where(
            'data.permissions',
            fn ($permissions): bool => collect(MoneyPermissions::ALL_PERMISSIONS)
                ->every(fn (string $permission): bool => in_array($permission, $permissions->all(), true))
        )->etc());
});

test('a cashier receives no money permissions in their session payload', function (): void {
    $cashier = User::factory()->create();
    $cashier->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($cashier);

    $this->getJson('/api/v1/auth/me')
        ->assertStatus(200)
        ->assertJson(fn ($json) => $json->where(
            'data.permissions',
            fn ($permissions): bool => collect($permissions->all())
                ->every(fn (string $permission): bool => ! str_starts_with($permission, 'money.'))
        )->etc());
});

test('every money permission declares which dashboard pages it governs', function (): void {
    foreach (MoneyPermissions::ALL_PERMISSIONS as $permission) {
        expect(MoneyPermissions::PAGE_MAP)->toHaveKey($permission)
            ->and(MoneyPermissions::PAGE_MAP[$permission])->not->toBeEmpty();
    }
});
