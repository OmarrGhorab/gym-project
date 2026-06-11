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

test('PROBE from filter with explicit time still applies low-bound? check exclusion', function (): void {
    // record at 05:00 on from-date; if " 00:00:00" appended to a date+time it becomes invalid -> may drop the WHERE silently
    Activity::create(['description' => 'early', 'created_at' => '2026-06-05 05:00:00']);
    Activity::create(['description' => 'before', 'created_at' => '2026-06-01 05:00:00']);
    // pass from as date+time noon
    $r = $this->getJson('/api/v1/audit-logs?filter[from]='.urlencode('2026-06-05 12:00:00'));
    fwrite(STDERR, "\nSTATUS=".$r->status()." DESCS=".json_encode(collect($r->json('data'))->pluck('description')->all())."\n");
    expect(true)->toBeTrue();
});

test('PROBE raw built string on sqlite for invalid datetime', function(): void {
    $r = \DB::table('activity_log')->where('created_at','>=','2026-06-05 12:00:00 00:00:00')->count();
    fwrite(STDERR, "\nINVALID_DT_COUNT=".$r."\n");
    expect(true)->toBeTrue();
});
