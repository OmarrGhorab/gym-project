<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Member;
use App\Models\MemberBooking;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
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
                    'commissions_positive',
                    'commissions_reversed',
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
    $servicePlan = Plan::factory()->create(['category' => 'personal_training']);
    $member = Member::factory()->active()->create();
    $addon = SubscriptionAddon::create([
        'subscription_id' => $sub->id,
        'member_id' => $member->id,
        'plan_id' => $servicePlan->id,
        'coach_id' => $employee->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'status' => 'active',
        'price_paid' => '900.00',
        'sold_by_user_id' => $employeeUser->id,
    ]);
    $addon->forceFill([
        'created_at' => '2026-06-12 12:00:00',
        'updated_at' => '2026-06-12 12:00:00',
    ])->save();
    $sale = Sale::factory()->create([
        'sold_by_user_id' => $employeeUser->id,
        'total' => '100.00',
        'created_at' => '2026-06-15 15:00:00',
    ]);
    MemberBooking::query()->create([
        'member_id' => $member->id,
        'coach_id' => $employee->id,
        'title' => 'Personal training session',
        'type' => 'session',
        'starts_at' => '2026-06-16 15:00:00',
        'status' => 'scheduled',
    ]);

    // Create commission for Jack
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '50.00',
        'created_at' => '2026-06-15 15:00:00',
    ]);
    Commission::factory()->create([
        'employee_id' => $employee->id,
        'amount' => '-15.00',
        'commission_type' => 'subscription_sale_refund',
        'calculation_type' => 'refund',
        'created_at' => '2026-06-20 15:00:00',
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
    expect($jackData['bookings_count'])->toBe(1);
    expect($jackData['coached_services_count'])->toBe(1);
    expect($jackData['coached_services_revenue'])->toBe('900.00');
    expect($jackData['commissions_positive'])->toBe('50.00');
    expect($jackData['commissions_reversed'])->toBe('15.00');
    expect($jackData['commissions_earned'])->toBe('35.00');
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
        ->assertJsonPath('data.commissions_positive', '50.00')
        ->assertJsonPath('data.commissions_reversed', '0.00')
        ->assertJsonPath('data.commissions_earned', '50.00')
        ->assertJsonPath('data.commissions.0.amount', '50.00')
        ->assertJsonPath('data.commissions.0.source_kind', 'pos_sale');
});

test('single employee performance includes the subscriptions and renewals they sold', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $employeeUser = User::factory()->create(['name' => 'Captain Jack']);
    $employee = Employee::factory()->create(['user_id' => $employeeUser->id]);
    $member = Member::factory()->active()->create([
        'email' => 'member@example.com',
        'name' => 'Member One',
        'phone' => '01000000000',
    ]);
    $plan = Plan::factory()->create(['name' => 'Monthly Membership']);
    $previousSubscription = Subscription::factory()->create(['member_id' => $member->id]);

    Subscription::factory()->create([
        'created_at' => '2026-06-15 12:00:00',
        'end_date' => '2026-07-15',
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '500.00',
        'sold_by_user_id' => $employeeUser->id,
        'start_date' => '2026-06-15',
        'upgraded_from_subscription_id' => $previousSubscription->id,
    ]);

    $response = $this->getJson("/api/v1/employees/{$employee->id}/performance?from=2026-06-01&to=2026-06-30")
        ->assertOk();

    expect($response->json('data.subscriptions'))->toHaveCount(1)
        ->and($response->json('data.subscriptions.0'))->toMatchArray([
            'member_email' => 'member@example.com',
            'member_name' => 'Member One',
            'member_phone' => '01000000000',
            'plan_name' => 'Monthly Membership',
            'price_paid' => '500.00',
            'type' => 'renewal',
        ]);
});

test('unauthenticated users cannot view performance reports', function (): void {
    $this->getJson('/api/v1/reports/employees')
        ->assertStatus(401);
});

test('users without reports.view permission cannot view employee performance list', function (): void {
    // Captain/Cashier now hold reports.view so they can open the Finance shift
    // desk (see RoleMatrixSeeder + PosAccessSeeder/HrFinanceAccessSeeder), so a
    // roleless user is the honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can('reports.view'))->toBeFalse();

    $this->getJson('/api/v1/reports/employees')
        ->assertStatus(403);
});
