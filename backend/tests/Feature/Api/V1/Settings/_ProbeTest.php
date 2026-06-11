<?php
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\SystemPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('PROBE settings index empty-state shape', function (): void {
    $admin = User::factory()->create(); $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
    $r = $this->getJson('/api/v1/settings');
    fwrite(STDERR, "\nSETTINGS_EMPTY=".$r->status()." ".json_encode($r->json('data'))."\n");
    expect(true)->toBeTrue();
});

test('PROBE colors stored as partial then read merges defaults', function (): void {
    $admin = User::factory()->create(); $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
    // store only primary
    $this->putJson('/api/v1/settings', ['gym'=>['colors'=>['primary'=>'#abcdef']]])->assertStatus(200);
    $r = $this->getJson('/api/v1/settings');
    fwrite(STDERR, "\nCOLORS=".json_encode($r->json('data.gym.colors'))."\n");
    expect(true)->toBeTrue();
});

test('PROBE accent color is dropped on read', function (): void {
    $admin = User::factory()->create(); $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
    $this->putJson('/api/v1/settings', ['gym'=>['colors'=>['primary'=>'#abcdef','secondary'=>'#123456','accent'=>'#fff000']]])->assertStatus(200);
    $r = $this->getJson('/api/v1/settings');
    fwrite(STDERR, "\nACCENT_READ=".json_encode($r->json('data.gym.colors'))."\n");
    expect(true)->toBeTrue();
});

test('PROBE deeply nested colors array accepted', function (): void {
    $admin = User::factory()->create(); $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
    $deep = ['gym'=>['colors'=>['primary'=>['x'=>['y'=>['z'=>str_repeat('a',100)]]]]]];
    $r = $this->putJson('/api/v1/settings', $deep);
    fwrite(STDERR, "\nDEEP_COLORS_STATUS=".$r->status()."\n");
    expect(true)->toBeTrue();
});
