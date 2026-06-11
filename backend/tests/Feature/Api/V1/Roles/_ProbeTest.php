<?php
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\SystemPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('PROBE sync strips role-based roles.manage while keeping direct grant', function (): void {
    $admin = User::factory()->create(); $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // target user: only one with roles.manage, has it BOTH via role AND directly
    $target = User::factory()->create();
    $custom = Role::create(['name'=>'CustomMgr','guard_name'=>'web']);
    $custom->givePermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
    $target->assignRole($custom);
    $target->givePermissionTo(SystemPermissions::PERM_ROLES_MANAGE); // direct too

    // remove admin so target is the ONLY roles.manage holder
    $admin->removeRole(FoundationPermissions::ROLE_ADMIN);
    $admin->givePermissionTo(SystemPermissions::PERM_ROLES_MANAGE); // keep acting user able
    Sanctum::actingAs($admin);

    // Now strip target's CustomMgr role -> they still have direct. Should be allowed.
    $r = $this->postJson("/api/v1/users/{$target->id}/roles", ['roles'=>['Cashier']]);
    fwrite(STDERR, "\nSYNC_DIRECT_KEPT_STATUS=".$r->status()."\n");
    expect(true)->toBeTrue();
});

test('PROBE create role with duplicate permissions array', function (): void {
    $admin = User::factory()->create(); $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
    $r = $this->postJson('/api/v1/roles', ['name'=>'Dup','permissions'=>['members.view','members.view']]);
    fwrite(STDERR, "\nDUP_PERM_STATUS=".$r->status()." PERMS=".json_encode($r->json('data.permissions'))."\n");
    expect(true)->toBeTrue();
});

test('PROBE roles.manage-only user deleting preset gets 422 not 403', function (): void {
    $admin = User::factory()->create();
    $admin->givePermissionTo(SystemPermissions::PERM_ROLES_MANAGE); // direct, no Admin role
    Sanctum::actingAs($admin);
    $preset = Role::where('name', FoundationPermissions::ROLE_CASHIER)->first();
    $r = $this->deleteJson("/api/v1/roles/{$preset->id}");
    fwrite(STDERR, "\nDELETE_PRESET_STATUS=".$r->status()."\n");
    expect(true)->toBeTrue();
});
