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

test('admin can create an employee and receives 201', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $targetUser = User::factory()->create();

    $this->postJson('/api/v1/employees', [
        'name' => 'John Doe',
        'phone' => '0123456789',
        'role' => 'captain',
        'base_salary' => '2500.00',
        'hire_date' => '2026-06-01',
        'status' => 'active',
        'user_id' => $targetUser->id,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.name', 'John Doe')
        ->assertJsonPath('data.role', 'captain')
        ->assertJsonPath('data.base_salary', '2500.00')
        ->assertJsonPath('data.user.id', $targetUser->id);
});

test('storing employee validation rejects negative base salary', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $this->postJson('/api/v1/employees', [
        'name' => 'John Doe',
        'role' => 'employee',
        'base_salary' => '-100.00',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['base_salary']]]);
});

test('storing employee validation rejects duplicate user_id link', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $targetUser = User::factory()->create();
    Employee::factory()->create(['user_id' => $targetUser->id]);

    $this->postJson('/api/v1/employees', [
        'name' => 'Second Employee',
        'role' => 'captain',
        'user_id' => $targetUser->id,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['user_id']]]);
});

test('storing employee validation rejects non-existent user_id link', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $this->postJson('/api/v1/employees', [
        'name' => 'Employee',
        'role' => 'captain',
        'user_id' => 99999,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['user_id']]]);
});

test('storing employee rejects invalid role value', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $this->postJson('/api/v1/employees', [
        'name' => 'John Doe',
        'role' => 'invalid-role',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('unauthenticated store employee request receives 401', function (): void {
    $this->postJson('/api/v1/employees', [
        'name' => 'Ahmed',
        'role' => 'captain',
    ])
        ->assertStatus(401);
});

test('user without employees.create permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/employees', [
        'name' => 'Ahmed',
        'role' => 'captain',
    ])
        ->assertStatus(403);
});
