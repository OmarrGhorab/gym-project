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

test('admin can list employees and receives 200', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    Employee::factory()->count(3)->create();

    $response = $this->getJson('/api/v1/employees')
        ->assertStatus(200)
        ->assertJsonCount(3, 'data');
});

test('can filter employees list by role', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    Employee::factory()->create(['role' => 'captain']);
    Employee::factory()->create(['role' => 'manager']);

    $response = $this->getJson('/api/v1/employees?filter[role]=captain')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');

    expect($response->json('data.0.role'))->toBe('captain');
});

test('can filter employees list by status', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    Employee::factory()->create(['status' => 'active']);
    Employee::factory()->create(['status' => 'inactive']);

    $response = $this->getJson('/api/v1/employees?filter[status]=inactive')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');

    expect($response->json('data.0.status'))->toBe('inactive');
});

test('can filter employees list by search query (q)', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    Employee::factory()->create(['name' => 'Ahmed Ali', 'phone' => '1234']);
    Employee::factory()->create(['name' => 'Sara Smith', 'phone' => '5678']);

    $response = $this->getJson('/api/v1/employees?filter[q]=Ahmed')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');

    expect($response->json('data.0.name'))->toBe('Ahmed Ali');

    $responsePhone = $this->getJson('/api/v1/employees?filter[q]=5678')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');

    expect($responsePhone->json('data.0.name'))->toBe('Sara Smith');
});

test('can filter employees list by id and attendance qr token', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $employee = Employee::factory()->create([
        'attendance_code' => 'EMP12345',
        'name' => 'Lookup Staff',
    ]);
    Employee::factory()->create(['name' => 'Other Staff']);

    $responseById = $this->getJson('/api/v1/employees?filter[q]='.$employee->id)
        ->assertStatus(200);

    expect(collect($responseById->json('data'))->pluck('id'))->toContain($employee->id);

    $responseByQr = $this->getJson('/api/v1/employees?filter[q]=employee:EMP12345')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');

    expect($responseByQr->json('data.0.id'))->toBe($employee->id);
});

test('unauthenticated employees index request receives 401', function (): void {
    $this->getJson('/api/v1/employees')
        ->assertStatus(401);
});

test('user without employees.view permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/employees')
        ->assertStatus(403);
});
