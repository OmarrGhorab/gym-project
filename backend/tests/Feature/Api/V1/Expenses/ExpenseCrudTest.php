<?php

use App\Models\Expense;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('authenticated manager or accountant can list expenses', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    Expense::factory()->count(3)->create();

    $response = $this->getJson('/api/v1/expenses')
        ->assertStatus(200)
        ->assertJsonCount(3, 'data');
});

test('unauthenticated users cannot list expenses', function (): void {
    $this->getJson('/api/v1/expenses')
        ->assertStatus(401);
});

test('users without expenses.view permission cannot list expenses', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/expenses')
        ->assertStatus(403);
});

test('expenses list can be filtered by category', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    Expense::factory()->create(['category' => 'rent']);
    Expense::factory()->create(['category' => 'utilities']);

    $response = $this->getJson('/api/v1/expenses?filter[category]=rent')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');

    expect($response->json('data.0.category'))->toBe('rent');
});

test('expenses list can be filtered by date range', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    Expense::factory()->create(['date' => '2026-06-01']);
    Expense::factory()->create(['date' => '2026-06-10']);
    Expense::factory()->create(['date' => '2026-06-20']);

    $response = $this->getJson('/api/v1/expenses?filter[start_date]=2026-06-05&filter[end_date]=2026-06-15')
        ->assertStatus(200)
        ->assertJsonCount(1, 'data');

    expect($response->json('data.0.date'))->toBe('2026-06-10');
});

test('expenses list includes total amount of filtered expenses in meta', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    Expense::factory()->create(['category' => 'rent', 'amount' => '1500.00']);
    Expense::factory()->create(['category' => 'utilities', 'amount' => '300.00']);
    Expense::factory()->create(['category' => 'rent', 'amount' => '1200.00']);

    $response = $this->getJson('/api/v1/expenses?filter[category]=rent')
        ->assertStatus(200)
        ->assertJsonCount(2, 'data');

    expect($response->json('meta.total_amount'))->toBe('2700.00');
});

test('manager can create expense and receives 201', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $this->postJson('/api/v1/expenses', [
        'category' => 'utilities',
        'amount' => '450.50',
        'description' => 'Electricity bill',
        'date' => '2026-06-11',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.category', 'utilities')
        ->assertJsonPath('data.amount', '450.50')
        ->assertJsonPath('data.description', 'Electricity bill')
        ->assertJsonPath('data.date', '2026-06-11')
        ->assertJsonPath('data.creator.id', $manager->id);

    expect(Expense::count())->toBe(1);
});

test('storing expense validation rejects missing fields and invalid types', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $this->postJson('/api/v1/expenses', [
        'category' => '',
        'amount' => '-10.00',
        'date' => 'not-a-date',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['category', 'amount', 'date']]]);
});

test('manager can update expense and receives 200', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $expense = Expense::factory()->create(['category' => 'rent', 'amount' => '1000.00']);

    $this->putJson("/api/v1/expenses/{$expense->id}", [
        'category' => 'rent',
        'amount' => '1200.00',
        'description' => 'Increased rent',
        'date' => '2026-06-12',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.category', 'rent')
        ->assertJsonPath('data.amount', '1200.00')
        ->assertJsonPath('data.date', '2026-06-12');

    expect($expense->refresh()->amount)->toBe('1200.00');
});

test('manager can delete expense and receives 204', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $expense = Expense::factory()->create();

    $this->deleteJson("/api/v1/expenses/{$expense->id}")
        ->assertStatus(204);

    expect(Expense::find($expense->id))->toBeNull();
});

test('payroll payout expenses cannot be updated or deleted from expense endpoints', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $expense = Expense::factory()->create([
        'category' => 'payroll',
        'amount' => '9000.00',
        'description' => 'Salary payout for Coach - Month: 2026-07',
        'date' => '2026-07-07',
    ]);

    $this->putJson("/api/v1/expenses/{$expense->id}", [
        'category' => 'payroll',
        'amount' => '1.00',
        'description' => 'Changed payout',
        'date' => '2026-07-08',
    ])->assertStatus(403);

    $this->deleteJson("/api/v1/expenses/{$expense->id}")
        ->assertStatus(403);

    expect($expense->refresh())
        ->amount->toBe('9000.00')
        ->description->toBe('Salary payout for Coach - Month: 2026-07');
});

test('user without expenses.create permission cannot create expense', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/expenses', [
        'category' => 'utilities',
        'amount' => '450.50',
        'description' => 'Electricity bill',
        'date' => '2026-06-11',
    ])
        ->assertStatus(403);
});
