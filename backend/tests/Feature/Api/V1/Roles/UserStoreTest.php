<?php

use App\Actions\Users\CreateUserAccount;
use App\Models\Employee;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('admin creates an immediately usable verified account with roles and an employee link', function (): void {
    Notification::fake();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    $employee = Employee::factory()->create(['user_id' => null, 'name' => 'Front Desk Employee']);
    Sanctum::actingAs($admin);

    $payload = [
        'name' => 'Front Desk Login',
        'email' => 'frontdesk@example.com',
        'password' => 'secure-password',
        'password_confirmation' => 'secure-password',
        'roles' => [
            FoundationPermissions::ROLE_CASHIER,
            FoundationPermissions::ROLE_CAPTAIN,
        ],
        'employee_id' => $employee->id,
    ];

    $this->postJson('/api/v1/users', $payload)
        ->assertCreated()
        ->assertJsonPath('data.name', 'Front Desk Login')
        ->assertJsonPath('data.email', 'frontdesk@example.com')
        ->assertJsonCount(2, 'data.roles');

    $user = User::query()->where('email', 'frontdesk@example.com')->firstOrFail();

    expect($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('secure-password', $user->password))->toBeTrue()
        ->and($user->hasAllRoles([
            FoundationPermissions::ROLE_CASHIER,
            FoundationPermissions::ROLE_CAPTAIN,
        ]))->toBeTrue()
        ->and($employee->fresh()->user_id)->toBe($user->id);

    $this->assertDatabaseMissing('email_verification_otps', ['email' => 'frontdesk@example.com']);
    Notification::assertNothingSent();

    $this->postJson('/api/v1/auth/login', [
        'email' => 'frontdesk@example.com',
        'password' => 'secure-password',
    ])->assertOk();
});

test('user without role management cannot create an account', function (): void {
    $captain = User::factory()->create();
    $captain->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($captain);

    $this->postJson('/api/v1/users', [
        'name' => 'Blocked User',
        'email' => 'blocked@example.com',
        'password' => 'secure-password',
        'password_confirmation' => 'secure-password',
        'roles' => [FoundationPermissions::ROLE_CAPTAIN],
    ])->assertForbidden();
});

test('account creation validates credentials roles and employee availability', function (array $overrides, string $field): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $payload = array_merge([
        'name' => 'New Employee',
        'email' => 'new-employee@example.com',
        'password' => 'secure-password',
        'password_confirmation' => 'secure-password',
        'roles' => [FoundationPermissions::ROLE_CAPTAIN],
    ], $overrides);

    $this->postJson('/api/v1/users', $payload)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => [$field]]]);
})->with([
    'duplicate email' => fn (): array => [
        ['email' => User::factory()->create()->email],
        'email',
    ],
    'weak password' => [
        ['password' => 'short', 'password_confirmation' => 'short'],
        'password',
    ],
    'missing roles' => [
        ['roles' => []],
        'roles',
    ],
    'unknown role' => [
        ['roles' => ['Unknown Role']],
        'roles.0',
    ],
    'linked employee' => fn (): array => [
        ['employee_id' => Employee::factory()->create(['user_id' => User::factory()->create()->id])->id],
        'employee_id',
    ],
]);

test('a failed role assignment rolls back account creation', function (): void {
    $email = 'rolled-back@example.com';

    try {
        app(CreateUserAccount::class)->handle([
            'name' => 'Rolled Back User',
            'email' => $email,
            'password' => 'secure-password',
            'roles' => ['Unknown Role'],
        ]);
    } catch (RoleDoesNotExist) {
        // Expected: role assignment happens inside the account transaction.
    }

    expect(User::query()->where('email', $email)->exists())->toBeFalse();
});
