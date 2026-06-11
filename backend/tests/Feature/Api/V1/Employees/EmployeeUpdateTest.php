<?php

use App\Models\Employee;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('admin can show employee and receives 200', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create();

    $this->getJson("/api/v1/employees/{$employee->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.id', $employee->id)
        ->assertJsonPath('data.name', $employee->name);
});

test('showing non-existent employee returns 404', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $this->getJson('/api/v1/employees/9999')
        ->assertStatus(404);
});

test('admin can update employee details and receives 200', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create();

    $this->putJson("/api/v1/employees/{$employee->id}", [
        'name' => 'Updated Name',
        'role' => 'manager',
        'base_salary' => '6000.00',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.name', 'Updated Name')
        ->assertJsonPath('data.role', 'manager')
        ->assertJsonPath('data.base_salary', '6000.00');
});

test('employee update validation excludes current row for user_id uniqueness check', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $targetUser = User::factory()->create();
    $employee = Employee::factory()->create(['user_id' => $targetUser->id]);

    // Update other details but keep same user_id, should succeed
    $this->putJson("/api/v1/employees/{$employee->id}", [
        'name' => 'New Name',
        'user_id' => $targetUser->id,
    ])
        ->assertStatus(200);
});

test('employee update validation rejects duplicate user_id linked to another employee', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $user1 = User::factory()->create();
    $user2 = User::factory()->create();

    $employee1 = Employee::factory()->create(['user_id' => $user1->id]);
    $employee2 = Employee::factory()->create(['user_id' => $user2->id]);

    // Attempt to update employee 2 to use user 1 (which employee 1 already uses)
    $this->putJson("/api/v1/employees/{$employee2->id}", [
        'user_id' => $user1->id,
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['user_id']]]);
});

test('admin can delete employee when no dependent history exists', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create();

    $this->deleteJson("/api/v1/employees/{$employee->id}")
        ->assertStatus(204);

    expect(Employee::find($employee->id))->toBeNull();
});

test('unauthenticated show employee receives 401', function (): void {
    $employee = Employee::factory()->create();
    $this->getJson("/api/v1/employees/{$employee->id}")
        ->assertStatus(401);
});

test('unauthorized update employee receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $employee = Employee::factory()->create();

    $this->putJson("/api/v1/employees/{$employee->id}", [
        'name' => 'Should fail',
    ])
        ->assertStatus(403);
});
