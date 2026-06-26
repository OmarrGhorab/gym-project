<?php

use App\Models\Commission;
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

test('employee commissions can be filtered by status', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $employee = Employee::factory()->create();
    Commission::factory()->for($employee)->create(['status' => 'pending']);
    Commission::factory()->for($employee)->create(['status' => 'paid']);

    $this->getJson("/api/v1/employees/{$employee->id}/commissions?status=paid")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.status', 'paid');
});
