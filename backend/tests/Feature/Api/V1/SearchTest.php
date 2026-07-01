<?php

use App\Models\Employee;
use App\Models\GymTask;
use App\Models\Member;
use App\Models\Product;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\MembershipPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('manager can search gym records globally', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    Member::factory()->create(['name' => 'Mona Strength', 'phone' => '+201111111111']);
    Employee::factory()->create(['name' => 'Mona Coach', 'role' => 'captain']);
    Product::factory()->create(['name' => 'Mona Protein Bar', 'sku' => 'MONA-BAR']);
    GymTask::query()->create([
        'title' => 'Call Mona renewal',
        'category' => 'membership',
        'status' => 'planned',
        'priority' => 'medium',
        'progress' => 0,
        'created_by' => $manager->id,
    ]);

    $this->getJson('/api/v1/search?q=Mona')
        ->assertOk()
        ->assertJsonPath('meta.query', 'Mona')
        ->assertJsonFragment(['title' => 'Mona Strength', 'group' => 'Members'])
        ->assertJsonFragment(['title' => 'Mona Coach', 'group' => 'Staff'])
        ->assertJsonFragment(['title' => 'Mona Protein Bar', 'group' => 'Inventory'])
        ->assertJsonFragment(['title' => 'Call Mona renewal', 'group' => 'Tasks']);
});

test('global search only includes permitted categories', function (): void {
    $memberViewer = User::factory()->create();
    $memberViewer->givePermissionTo(MembershipPermissions::PERM_MEMBERS_VIEW);
    Sanctum::actingAs($memberViewer);

    Member::factory()->create(['name' => 'Nour Member']);
    Employee::factory()->create(['name' => 'Nour Staff']);

    $response = $this->getJson('/api/v1/search?q=Nour')
        ->assertOk();

    expect(collect($response->json('data'))->pluck('group')->unique()->values()->all())
        ->toBe(['Members']);
});

test('global search validates query length', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $this->getJson('/api/v1/search?q=a')
        ->assertUnprocessable();
});
