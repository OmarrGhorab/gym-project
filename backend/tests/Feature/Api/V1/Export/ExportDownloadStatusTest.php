<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
    Storage::fake('local');
});

// ---------------------------------------------------------------------------
// Helper: seed a cache entry and (optionally) a fake file on the local disk
// ---------------------------------------------------------------------------
function fakeExport(string $exportId, array $overrides = [], bool $withFile = false): void
{
    $meta = array_merge([
        'id'       => $exportId,
        'resource' => 'members',
        'format'   => 'xlsx',
        'status'   => 'completed',
        'user_id'  => 1,
        'filename' => "exports/{$exportId}.xlsx",
    ], $overrides);

    Cache::put("export:{$exportId}", $meta, now()->addHours(24));

    if ($withFile) {
        Storage::disk('local')->put($meta['filename'], 'fake-excel-bytes');
    }
}

function signedDownloadUrl(string $exportId): string
{
    return URL::temporarySignedRoute(
        'export.download',
        now()->addHour(),
        ['exportId' => $exportId]
    );
}

// ---------------------------------------------------------------------------
// GET /export/download/{exportId}
// ---------------------------------------------------------------------------

test('download returns 403 when export metadata not found', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $url = signedDownloadUrl('non-existent-id');

    $this->getJson($url)
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('download returns 202 while export is still processing', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $id = 'proc-export-id';
    fakeExport($id, ['status' => 'processing', 'user_id' => $admin->id]);

    $url = signedDownloadUrl($id);

    $this->getJson($url)
        ->assertStatus(202)
        ->assertJsonPath('data.status', 'processing')
        ->assertJsonPath('data.export_id', $id);
});

test('download returns 500 when export job failed', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $id = 'failed-export-id';
    fakeExport($id, ['status' => 'failed', 'user_id' => $admin->id, 'error' => 'DB connection lost']);

    $url = signedDownloadUrl($id);

    $this->getJson($url)
        ->assertStatus(500)
        ->assertJsonPath('error.code', 'export_failed');
});

test('download returns 404 when file is missing from disk', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $id = 'disk-missing-id';
    fakeExport($id, ['user_id' => $admin->id]); // no file written to disk

    $url = signedDownloadUrl($id);

    $this->getJson($url)
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});

test('download streams the file when export is completed', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $id = 'ready-export-id';
    fakeExport($id, ['user_id' => $admin->id], withFile: true);

    $url = signedDownloadUrl($id);

    $response = $this->get($url);

    $response->assertStatus(200);
    expect($response->headers->get('content-disposition'))->toContain('members_export.xlsx');
});

test('download returns 403 when a different user tries to use the signed URL', function (): void {
    $owner = User::factory()->create();
    $owner->assignRole(FoundationPermissions::ROLE_ADMIN);

    $other = User::factory()->create();
    $other->assignRole(FoundationPermissions::ROLE_ADMIN);

    $id = 'idor-download-id';
    fakeExport($id, ['user_id' => $owner->id], withFile: true);

    $url = signedDownloadUrl($id);

    Sanctum::actingAs($other);
    $this->getJson($url)->assertStatus(403);
});

test('download returns 403 when signed URL signature is missing', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $id = 'unsigned-id';
    fakeExport($id, ['user_id' => $admin->id], withFile: true);

    // Call without a signed URL
    $this->getJson("/api/v1/export/download/{$id}")->assertStatus(403);
});

// ---------------------------------------------------------------------------
// GET /export/status/{exportId}
// ---------------------------------------------------------------------------

test('status returns export metadata for the owning user', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $id = 'status-my-export';
    fakeExport($id, ['user_id' => $admin->id]);

    $this->getJson("/api/v1/export/status/{$id}")
        ->assertStatus(200)
        ->assertJsonPath('data.export_id', $id)
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.resource', 'members')
        ->assertJsonPath('data.format', 'xlsx');
});

test('status returns 404 when export not found', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/export/status/does-not-exist')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('status returns 403 when a different user polls for the export', function (): void {
    $owner = User::factory()->create();
    $owner->assignRole(FoundationPermissions::ROLE_ADMIN);

    $other = User::factory()->create();
    $other->assignRole(FoundationPermissions::ROLE_ADMIN);

    $id = 'idor-status-id';
    fakeExport($id, ['user_id' => $owner->id]);

    Sanctum::actingAs($other);
    $this->getJson("/api/v1/export/status/{$id}")->assertStatus(403);
});

test('status returns 401 for unauthenticated request', function (): void {
    $id = 'unauth-status-id';
    fakeExport($id, ['user_id' => 999]);

    $this->getJson("/api/v1/export/status/{$id}")->assertStatus(401);
});
