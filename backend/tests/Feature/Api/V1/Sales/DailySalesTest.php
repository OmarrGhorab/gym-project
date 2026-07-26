<?php

use App\Models\Sale;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\PosPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\PosAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(PosAccessSeeder::class);
});

test('unauthenticated users cannot view daily sales report', function (): void {
    $this->getJson('/api/v1/sales/daily')->assertStatus(401);
});

test('users without reports.view permission cannot view daily sales report', function (): void {
    // Cashier deliberately holds reports.view (PosAccessSeeder / RoleMatrixSeeder)
    // so front desk can open the Finance shift desk, so a roleless user is the
    // honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can(PosPermissions::PERM_REPORTS_VIEW))->toBeFalse();

    $this->getJson('/api/v1/sales/daily')->assertStatus(403);
});

test('manager with reports.view permission can view daily sales report and reconcile totals', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    // Sales today
    $sale1 = Sale::factory()->create(['status' => 'completed', 'total' => '100.00', 'created_at' => now()]);
    $sale1->payment()->create(['amount' => '100.00', 'method' => 'cash', 'status' => 'paid', 'created_by' => $user->id]);

    $sale2 = Sale::factory()->create(['status' => 'completed', 'total' => '50.00', 'created_at' => now()]);
    $sale2->payment()->create(['amount' => '50.00', 'method' => 'card', 'status' => 'paid', 'created_by' => $user->id]);

    // Voided sale today (should be ignored in completed/total sum)
    $saleVoided = Sale::factory()->voided()->create(['total' => '20.00', 'created_at' => now()]);
    $saleVoided->payment()->create(['amount' => '20.00', 'method' => 'cash', 'status' => 'voided', 'created_by' => $user->id]);

    // Sale yesterday (should be ignored)
    $saleYesterday = Sale::factory()->create(['status' => 'completed', 'total' => '200.00', 'created_at' => now()->subDay()]);
    $saleYesterday->payment()->create(['amount' => '200.00', 'method' => 'cash', 'status' => 'paid', 'created_by' => $user->id]);

    $response = $this->getJson('/api/v1/sales/daily')
        ->assertStatus(200)
        ->assertJsonPath('data.total_revenue', '150.00')
        ->assertJsonCount(2, 'data.sales');

    // Retrieve custom date (yesterday)
    $yesterdayDate = now()->subDay()->toDateString();
    $this->getJson("/api/v1/sales/daily?date={$yesterdayDate}")
        ->assertStatus(200)
        ->assertJsonPath('data.total_revenue', '200.00')
        ->assertJsonCount(1, 'data.sales');
});

test('it validates the date format', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/sales/daily?date=invalid-date')
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['date']]]);
});
