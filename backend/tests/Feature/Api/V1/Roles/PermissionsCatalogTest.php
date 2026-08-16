<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\MoneyPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('admin user can access permissions catalog', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/permissions')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('data.system')
            ->has('data.members')
            ->where('data.reports', fn ($permissions): bool => $permissions->contains('reports.view_today'))
            ->has('meta')
            ->has('message')
        );
});

test('non-admin user without roles.manage cannot access permissions catalog', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/permissions')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('unauthenticated request receives 401', function (): void {
    $this->getJson('/api/v1/permissions')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

/**
 * The catalog is defined in code but roles are saved against the permissions
 * table. Offering a permission that has not been seeded yet renders a checkbox
 * that fails validation the moment it is ticked — "The selected permissions.0
 * is invalid" — with nothing on screen explaining why.
 */
test('it only offers permissions that a role can actually be given', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Permission::query()->where('name', MoneyPermissions::PERM_MONEY_REPORTS_VIEW)->delete();
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $offered = collect($this->getJson('/api/v1/permissions')->assertOk()->json('data'))->flatten();

    expect($offered)->not->toContain(MoneyPermissions::PERM_MONEY_REPORTS_VIEW)
        // The rest of the family is still registered, so it is still on offer.
        ->and($offered)->toContain(MoneyPermissions::PERM_MONEY_PAYROLL_VIEW);
});

/** Every permission the screen offers must survive a save. */
test('everything the catalog offers can be saved onto a role', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $offered = collect($this->getJson('/api/v1/permissions')->assertOk()->json('data'))->flatten()->all();
    $role = Role::create(['name' => 'Everything', 'guard_name' => 'web']);

    $this->putJson("/api/v1/roles/{$role->id}", [
        'name' => 'Everything',
        'permissions' => $offered,
    ])->assertOk();

    expect($role->fresh()->permissions)->toHaveCount(count($offered));
});
