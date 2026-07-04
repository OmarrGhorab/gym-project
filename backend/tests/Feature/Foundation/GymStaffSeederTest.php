<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use Database\Seeders\EmployeeShiftSeeder;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\GymStaffSeeder;
use Database\Seeders\RoleMatrixSeeder;

test('gym staff seeder creates practical shifts and employees', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);

    expect(EmployeeShift::whereIn('name', [
        'Opening Shift',
        'Midday Shift',
        'Evening Shift',
        'Night Security Shift',
        'Weekend Shift',
        'Flexible Admin Shift',
    ])->count())->toBe(6)
        ->and(Employee::where('phone', 'like', '+2010111100%')->count())->toBe(13)
        ->and(Employee::where('name', 'Nutrition Coach')->first()?->role)->toBe('captain')
        ->and(Employee::where('name', 'Maintenance Technician')->first()?->user_id)->toBeNull();

    $frontDesk = User::where('email', 'frontdesk@gym.test')->firstOrFail();
    $nutritionCoach = User::where('email', 'nutrition.coach@gym.test')->firstOrFail();

    expect($frontDesk->hasRole('Cashier'))->toBeTrue()
        ->and($nutritionCoach->hasRole('Captain'))->toBeTrue();
});

test('gym staff seeder is idempotent', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);

    expect(EmployeeShift::where('name', 'Opening Shift')->count())->toBe(1)
        ->and(User::where('email', 'frontdesk@gym.test')->count())->toBe(1)
        ->and(Employee::where('phone', '+201011110006')->count())->toBe(1);
});
