<?php

use App\Models\Employee;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can view system health summary with setup warnings', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $employee = Employee::factory()->create([
        'name' => 'Unassigned Coach',
        'shift_id' => null,
        'user_id' => null,
        'attendance_code' => null,
        'status' => 'active',
    ]);
    $employee->forceFill(['attendance_code' => null])->save();
    Product::factory()->create([
        'name' => 'Protein Bar',
        'image' => null,
        'is_active' => true,
    ]);
    Setting::query()->whereIn('key', [
        'attendance.gym_latitude',
        'attendance.gym_longitude',
        'attendance.gym_radius_meters',
    ])->delete();

    $this->getJson('/api/v1/reports/system-health')
        ->assertOk()
        ->assertJsonPath('data.groups.0.name', 'Core Operations')
        ->assertJsonPath('data.groups.1.name', 'Staff & Attendance')
        ->assertJsonPath('data.summary.modules_count', 9)
        ->assertJsonPath('data.groups.1.rows.0.checks.0.label', 'Without shift')
        ->assertJsonPath('data.groups.1.rows.0.checks.0.value', '1')
        ->assertJsonPath('data.groups.4.rows.1.status', 'critical')
        ->assertJsonCount(5, 'data.groups');
});

test('users without reports permission cannot view system health summary', function (): void {
    // Captain/Cashier now hold reports.view so they can open the Finance shift
    // desk (see RoleMatrixSeeder + PosAccessSeeder/HrFinanceAccessSeeder), so a
    // roleless user is the honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can('reports.view'))->toBeFalse();

    $this->getJson('/api/v1/reports/system-health')
        ->assertForbidden();
});
