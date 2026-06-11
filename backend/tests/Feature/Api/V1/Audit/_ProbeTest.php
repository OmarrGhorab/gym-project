<?php
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
});

test('PROBE causer=abc non-integer', function (): void {
    Activity::create(['description' => 'x', 'created_at' => now()]);
    $r = $this->getJson('/api/v1/audit-logs?filter[causer]=abc');
    fwrite(STDERR, "\nCAUSER_ABC_STATUS=".$r->status()."\n");
    expect(true)->toBeTrue();
});

test('PROBE from with time component', function (): void {
    Activity::create(['description' => 'x', 'created_at' => '2026-06-10 10:00:00']);
    $r = $this->getJson('/api/v1/audit-logs?filter[from]=2026-06-01 12:00:00');
    fwrite(STDERR, "\nFROM_WITHTIME_STATUS=".$r->status()." COUNT=".count($r->json('data') ?? [])."\n");
    expect(true)->toBeTrue();
});

test('PROBE subject unknown alias key direct', function (): void {
    // bypassing validation? send subject that passes validation but...
    $r = $this->getJson('/api/v1/audit-logs?filter[causer]=99999999');
    fwrite(STDERR, "\nCAUSER_BIG_STATUS=".$r->status()."\n");
    expect(true)->toBeTrue();
});
