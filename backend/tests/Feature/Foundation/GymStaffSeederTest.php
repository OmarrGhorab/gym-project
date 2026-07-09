<?php

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use Database\Seeders\EmployeeShiftSeeder;
use Database\Seeders\GymStaffSeeder;

test('gym staff seeder creates practical shifts and employees without assigning roles', function (): void {
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
        ->and(Employee::where('name', 'Sara Mounir')->first()?->role)->toBe('coach')
        ->and(Employee::where('name', 'Hossam Yassin')->first()?->user_id)->toBeNull();

    $frontDesk = User::where('email', 'frontdesk@gym.test')->firstOrFail();
    $nutritionCoach = User::where('email', 'nutrition.coach@gym.test')->firstOrFail();

    expect($frontDesk->roles)->toHaveCount(0)
        ->and($nutritionCoach->roles)->toHaveCount(0);
});

test('gym staff seeder is idempotent', function (): void {
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);
    $this->seed(EmployeeShiftSeeder::class);
    $this->seed(GymStaffSeeder::class);

    expect(EmployeeShift::where('name', 'Opening Shift')->count())->toBe(1)
        ->and(User::where('email', 'frontdesk@gym.test')->count())->toBe(1)
        ->and(Employee::where('phone', '+201011110006')->count())->toBe(1);
});
