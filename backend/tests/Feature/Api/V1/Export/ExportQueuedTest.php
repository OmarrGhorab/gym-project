<?php

use App\Jobs\GenerateExportJob;
use App\Models\Member;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('over threshold exports are queued', function (): void {
    Queue::fake();

    // Set threshold to 1 row
    Config::set('export.sync_threshold', 1);

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Create 2 members to exceed threshold of 1
    Member::factory()->count(2)->create();

    $response = $this->getJson('/api/v1/export/members?format=xlsx')
        ->assertStatus(202)
        ->assertJsonStructure(['data' => ['export_id', 'status']])
        ->assertJsonPath('data.status', 'processing');

    Queue::assertPushed(GenerateExportJob::class);
});
