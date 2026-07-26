<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\EmployeeShiftSeeder;
use Database\Seeders\GymStaffSeeder;
use Spatie\Permission\Models\Role;

test('gym staff seeder staffs every desk shift and can run without pre-seeded roles', function (): void {
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);

    expect(EmployeeShift::whereIn('name', [
        'Morning Desk 06-11',
        'Midday Desk 11-16',
        'Evening Desk 16-21',
        'Closing Desk 21-00',
        'Flexible Admin',
    ])->count())->toBe(5)
        ->and(Employee::count())->toBe(count(GymStaffSeeder::staffRecords()))
        ->and(Employee::where('name', 'Sara Coach')->first()?->role)->toBe('coach');

    // Every desk shift carries its own cashiers so shift-desk handover flows are testable.
    foreach (['Morning Desk 06-11', 'Midday Desk 11-16', 'Evening Desk 16-21', 'Closing Desk 21-00'] as $shiftName) {
        $shiftId = EmployeeShift::where('name', $shiftName)->value('id');

        expect(Employee::where('shift_id', $shiftId)->count())->toBeGreaterThanOrEqual(3);
    }

    // The seeder provisions the roles it needs, so a standalone run still wires access up.
    expect(Role::where('name', FoundationPermissions::ROLE_CASHIER)->where('guard_name', 'web')->exists())->toBeTrue();

    $deskCashier = User::where('email', 'morning.cashier1@gym.test')->firstOrFail();
    $manager = User::where('email', 'operations.manager@gym.test')->firstOrFail();
    $accountant = User::where('email', 'gym.accountant@gym.test')->firstOrFail();
    $captain = User::where('email', 'head.captain@gym.test')->firstOrFail();

    expect($deskCashier->hasRole(FoundationPermissions::ROLE_CASHIER))->toBeTrue()
        ->and($manager->hasRole(FoundationPermissions::ROLE_MANAGER))->toBeTrue()
        ->and($accountant->hasRole(FoundationPermissions::ROLE_ACCOUNTANT))->toBeTrue()
        ->and($captain->hasRole(FoundationPermissions::ROLE_CAPTAIN))->toBeTrue();

    // Coaches get a login for the academy screens but no back-office access role.
    $nutritionCoach = User::where('email', 'nutrition.coach@gym.test')->firstOrFail();
    $personalTrainer = User::where('email', 'personal.trainer@gym.test')->firstOrFail();

    expect($nutritionCoach->roles)->toHaveCount(0)
        ->and($personalTrainer->roles)->toHaveCount(0);
});

test('gym staff seeder is idempotent', function (): void {
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);

    expect(EmployeeShift::where('name', 'Morning Desk 06-11')->count())->toBe(1)
        ->and(User::where('email', 'morning.cashier1@gym.test')->count())->toBe(1)
        ->and(Employee::where('phone', '+201011110006')->count())->toBe(1)
        ->and(Employee::count())->toBe(count(GymStaffSeeder::staffRecords()))
        ->and(User::where('email', 'morning.cashier1@gym.test')->firstOrFail()->roles)->toHaveCount(1);
});
