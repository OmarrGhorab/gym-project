<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
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

test('authenticated user with reports.view permission can view employee performance list', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $response = $this->getJson('/api/v1/reports/employees?from=2026-06-01&to=2026-06-30')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => [
                    'employee_id',
                    'name',
                    'role',
                    'sales_count',
                    'subscriptions_count',
                    'commissions_earned',
                ],
            ],
            'meta',
            'message',
        ]);
});

test('employee performance reports are accurate and attributed correctly', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Create active employee linked to user
    $employeeUser = User::factory()->create(['name' => 'Captain Jack']);
    $employee = Employee::factory()->create([
        'user_id' => $employeeUser->id,
        'role' => 'captain',
        'status' => 'active',
    ]);

    // Create subscriptions and sales sold by Jack
    $plan = Plan::factory()->create(['price' => '300.00']);
    $sub = Subscription::factory()->create([
        'sold_by_user_id' => $employeeUser->id,
        'created_at' => '2026-06-10 12:00:00',
    ]);
    $sale = Sale::factory()->create([
        'sold_by_user_id' => $employeeUser->id,
        'total' => '100.00',
        'created_at' => '2026-06-15 15:00:00',
    ]);

    // Create commission for Jack
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '50.00',
        'created_at' => '2026-06-15 15:00:00',
    ]);

    // Another employee's data
    $otherUser = User::factory()->create();
    $otherEmployee = Employee::factory()->create([
        'user_id' => $otherUser->id,
    ]);
    Commission::factory()->create([
        'employee_id' => $otherEmployee->id,
        'amount' => '75.00',
    ]);

    // Request report
    $response = $this->getJson('/api/v1/reports/employees?from=2026-06-01&to=2026-06-30')
        ->assertStatus(200);

    $jackData = collect($response->json('data'))->firstWhere('employee_id', $employee->id);
    expect($jackData)->not->toBeNull();
    expect($jackData['sales_count'])->toBe(1);
    expect($jackData['subscriptions_count'])->toBe(1);
    expect($jackData['commissions_earned'])->toBe('50.00');
});

test('can view single employee performance report', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employeeUser = User::factory()->create(['name' => 'Captain Jack']);
    $employee = Employee::factory()->create([
        'user_id' => $employeeUser->id,
        'role' => 'captain',
        'status' => 'active',
    ]);

    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '50.00',
        'created_at' => '2026-06-15 15:00:00',
    ]);

    $response = $this->getJson("/api/v1/employees/{$employee->id}/performance?from=2026-06-01&to=2026-06-30")
        ->assertStatus(200)
        ->assertJsonPath('data.employee_id', $employee->id)
        ->assertJsonPath('data.name', 'Captain Jack')
        ->assertJsonPath('data.commissions_earned', '50.00');
});

test('unauthenticated users cannot view performance reports', function (): void {
    $this->getJson('/api/v1/reports/employees')
        ->assertStatus(401);
});

test('users without reports.view permission cannot view employee performance list', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/employees')
        ->assertStatus(403);
});
