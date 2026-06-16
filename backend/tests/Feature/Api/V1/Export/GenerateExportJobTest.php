<?php

use App\Jobs\GenerateExportJob;
use App\Models\Member;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\Models\Activity;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
    Storage::fake('local');
});

test('job writes completed status to cache and stores the file', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Member::factory()->count(2)->create();

    $exportId = 'job-test-complete';
    $resource = 'members';
    $format = 'csv';

    Cache::put("export:{$exportId}", [
        'id' => $exportId,
        'resource' => $resource,
        'format' => $format,
        'status' => 'processing',
        'user_id' => $user->id,
    ], now()->addHour());

    GenerateExportJob::dispatchSync($exportId, $resource, $format, [], $user->id);

    $meta = Cache::get("export:{$exportId}");

    expect($meta['status'])->toBe('completed')
        ->and($meta['user_id'])->toBe($user->id)
        ->and($meta['filename'])->toBe("exports/{$exportId}.{$format}");

    Storage::disk('local')->assertExists("exports/{$exportId}.{$format}");
});

test('job writes failed status to cache when excel store throws', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    $exportId = 'job-test-fail';

    Cache::put("export:{$exportId}", [
        'id' => $exportId,
        'status' => 'processing',
        'user_id' => $user->id,
    ], now()->addHour());

    // Force an error by using an invalid resource name directly
    try {
        GenerateExportJob::dispatchSync($exportId, 'invalid_resource', 'csv', [], $user->id);
    } catch (Throwable) {
        // expected — job rethrows
    }

    $meta = Cache::get("export:{$exportId}");

    expect($meta['status'])->toBe('failed')
        ->and($meta['error'])->not->toBeEmpty();
});

test('job attributes audit log entry to the triggering user', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Member::factory()->count(1)->create();

    $exportId = 'job-test-audit';
    Config::set('activitylog.enabled', true);

    Cache::put("export:{$exportId}", [
        'id' => $exportId,
        'status' => 'processing',
        'user_id' => $user->id,
    ], now()->addHour());

    GenerateExportJob::dispatchSync($exportId, 'members', 'csv', [], $user->id);

    $log = Activity::where('causer_id', $user->id)
        ->where('causer_type', User::class)
        ->latest()
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->description)->toContain('members');
});

test('job with deleted user still completes without throwing', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Member::factory()->count(1)->create();

    $exportId = 'job-test-deleted-user';
    $userId = $user->id;

    Cache::put("export:{$exportId}", [
        'id' => $exportId,
        'status' => 'processing',
        'user_id' => $userId,
    ], now()->addHour());

    // Delete the user before the job runs (simulates race condition)
    $user->delete();

    GenerateExportJob::dispatchSync($exportId, 'members', 'csv', [], $userId);

    $meta = Cache::get("export:{$exportId}");
    expect($meta['status'])->toBe('completed');
});
