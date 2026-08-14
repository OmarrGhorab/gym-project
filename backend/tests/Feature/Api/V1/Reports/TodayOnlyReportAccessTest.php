<?php

use App\Models\Expense;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Subscription;
use App\Models\User;
use App\Support\PosPermissions;
use App\Support\SystemPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow('2026-08-14 12:00:00');
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function actAsTodayOnlyReportViewer(): User
{
    $role = Role::query()->firstOrCreate(['name' => 'Daily finance viewer', 'guard_name' => 'web']);
    $role->syncPermissions([PosPermissions::PERM_REPORTS_VIEW_TODAY]);

    $user = User::factory()->create();
    $user->assignRole($role);
    Sanctum::actingAs($user);

    return $user;
}

test('today-only viewer can open reports but forged dates are replaced with today', function (): void {
    $viewer = actAsTodayOnlyReportViewer();
    $subscription = Subscription::factory()->create();

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '125.00',
        'status' => 'paid',
        'paid_at' => '2026-08-14 10:00:00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '900.00',
        'status' => 'paid',
        'paid_at' => '2026-08-13 10:00:00',
    ]);
    Expense::factory()->create([
        'amount' => '25.00',
        'date' => '2026-08-14',
        'created_by' => $viewer->id,
    ]);
    Expense::factory()->create([
        'amount' => '400.00',
        'date' => '2026-08-13',
        'created_by' => $viewer->id,
    ]);

    $this->getJson('/api/v1/reports/financial?from=2025-01-01&to=2025-12-31&group_by=month')
        ->assertOk()
        ->assertJsonPath('meta.from', '2026-08-14')
        ->assertJsonPath('meta.to', '2026-08-14')
        ->assertJsonPath('meta.group_by', 'day')
        ->assertJsonPath('meta.totals.revenue', '125.00')
        ->assertJsonPath('meta.totals.expenses', '25.00')
        ->assertJsonCount(1, 'data');
});

test('today-only finance summary omits historical comparisons and obligations', function (): void {
    actAsTodayOnlyReportViewer();
    $subscription = Subscription::factory()->create(['price_paid' => '100.00']);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '100.00',
        'status' => 'paid',
        'paid_at' => '2026-08-14 11:00:00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '800.00',
        'status' => 'paid',
        'paid_at' => '2026-08-13 11:00:00',
    ]);

    $this->getJson('/api/v1/reports/finance-summary?from=2026-01-01&to=2026-08-13')
        ->assertOk()
        ->assertJsonPath('data.totals.revenue_mtd', '100.00')
        ->assertJsonPath('data.totals.previous_revenue_mtd', '0.00')
        ->assertJsonPath('data.totals.pending_payroll', '0.00')
        ->assertJsonPath('data.totals.outstanding_dues', '0.00')
        ->assertJsonPath('data.upcoming.pending_payroll', [])
        ->assertJsonPath('data.upcoming.dues', []);
});

test('today-only POS report never falls back to older transactions', function (): void {
    actAsTodayOnlyReportViewer();
    $product = Product::factory()->create();
    $oldSale = Sale::factory()->create([
        'status' => 'completed',
        'total' => '700.00',
        'created_at' => '2026-08-13 14:00:00',
    ]);
    SaleItem::factory()->create([
        'product_id' => $product->id,
        'sale_id' => $oldSale->id,
        'quantity' => 1,
        'total' => '700.00',
    ]);

    $this->getJson('/api/v1/reports/products-finance?from=2026-08-13&to=2026-08-13')
        ->assertOk()
        ->assertJsonPath('data.totals.total_pos_revenue', '0.00')
        ->assertJsonPath('data.totals.total_orders', 0)
        ->assertJsonPath('data.transactions', []);
});

test('today-only viewer cannot open lifetime membership history', function (): void {
    actAsTodayOnlyReportViewer();
    $member = Member::factory()->create();
    Subscription::factory()->create([
        'member_id' => $member->id,
        'start_date' => '2026-08-01',
        'end_date' => '2026-08-31',
    ]);

    $this->getJson("/api/v1/reports/member-subscriptions?member_id={$member->id}")
        ->assertForbidden();
});

test('today-only restriction also blocks report exports when export permission is added', function (): void {
    $user = actAsTodayOnlyReportViewer();
    $exportPermission = Permission::query()->firstOrCreate([
        'name' => SystemPermissions::PERM_EXPORT_REPORTS,
        'guard_name' => 'web',
    ]);
    $user->roles()->firstOrFail()->givePermissionTo($exportPermission);

    $this->getJson('/api/v1/export/reports?format=csv')
        ->assertForbidden();
});

test('full report permission still honors requested historical ranges', function (): void {
    $role = Role::query()->create(['name' => 'Full report viewer', 'guard_name' => 'web']);
    $role->givePermissionTo([
        PosPermissions::PERM_REPORTS_VIEW,
        PosPermissions::PERM_REPORTS_VIEW_TODAY,
    ]);
    $user = User::factory()->create();
    $user->assignRole($role);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/financial?from=2026-08-01&to=2026-08-02&group_by=day')
        ->assertOk()
        ->assertJsonPath('meta.from', '2026-08-01')
        ->assertJsonPath('meta.to', '2026-08-02')
        ->assertJsonPath('meta.group_by', 'day');
});
