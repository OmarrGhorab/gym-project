<?php
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Actions\Export\BuildExport;
use App\Exports\MembersExport;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Cache;
use Maatwebsite\Excel\Facades\Excel;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('PROBE getCountForPagination on MembersExport with selectSub', function (): void {
    \App\Models\Member::factory()->count(3)->create();
    $b = new BuildExport;
    $cls = $b->getExportClass('members', []);
    try {
        $c = $cls->query()->toBase()->getCountForPagination();
        fwrite(STDERR, "\nMEMBERS_COUNT=".$c."\n");
    } catch (\Throwable $e) {
        fwrite(STDERR, "\nMEMBERS_COUNT_ERR=".get_class($e).": ".$e->getMessage()."\n");
    }
    expect(true)->toBeTrue();
});

test('PROBE sync download headers content-disposition', function (): void {
    $admin = User::factory()->create(); $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);
    $r = $this->get('/api/v1/export/members?format=csv');
    fwrite(STDERR, "\nCSV_CT=".$r->headers->get('content-type')." CD=".$r->headers->get('content-disposition')."\n");
    expect(true)->toBeTrue();
});

test('PROBE IDOR status across users', function (): void {
    $u1 = User::factory()->create(); $u1->assignRole(FoundationPermissions::ROLE_ADMIN);
    $u2 = User::factory()->create(); $u2->assignRole(FoundationPermissions::ROLE_ADMIN);
    $eid='abc-123';
    Cache::put("export:{$eid}", ['id'=>$eid,'resource'=>'members','format'=>'xlsx','status'=>'completed','user_id'=>$u1->id,'filename'=>'exports/x.xlsx'], now()->addHour());
    Sanctum::actingAs($u2);
    $r = $this->getJson("/api/v1/export/status/{$eid}");
    fwrite(STDERR, "\nIDOR_STATUS=".$r->status()."\n");
    expect(true)->toBeTrue();
});
