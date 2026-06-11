<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;
use Maatwebsite\Excel\Facades\Excel;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('admin can export members in xlsx format', function (): void {
    Excel::fake();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/export/members?format=xlsx')
        ->assertStatus(200);

    Excel::assertDownloaded('members.xlsx');
});

test('admin can export members in csv format', function (): void {
    Excel::fake();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/export/members?format=csv')
        ->assertStatus(200);

    Excel::assertDownloaded('members.csv');
});
