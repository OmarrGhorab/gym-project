<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class GymStaffSeeder extends Seeder
{
    /**
     * Seed realistic gym staff employees and login users for daily operations.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            foreach ($this->staff() as $staffMember) {
                $user = null;

                if ($staffMember['email'] !== null) {
                    $user = User::query()->updateOrCreate(
                        ['email' => $staffMember['email']],
                        [
                            'name' => $staffMember['name'],
                            'password' => Hash::make('password'),
                        ],
                    );

                    if ($user->email_verified_at === null) {
                        $user->forceFill(['email_verified_at' => now()])->save();
                    }

                    $user->syncRoles([$staffMember['access_role']]);
                }

                Employee::query()->updateOrCreate(
                    ['phone' => $staffMember['phone']],
                    [
                        'user_id' => $user?->id,
                        'name' => $staffMember['name'],
                        'role' => $staffMember['employee_role'],
                        'base_salary' => $staffMember['base_salary'],
                        'commission_rate' => $staffMember['commission_rate'],
                        'shift_id' => $this->shiftId($staffMember['shift']),
                        'hire_date' => $staffMember['hire_date'],
                        'status' => 'active',
                    ],
                );
            }
        });
    }

    private function shiftId(string $name): int
    {
        return EmployeeShift::query()->where('name', $name)->firstOrFail()->id;
    }

    /**
     * Employee roles must stay aligned with StoreEmployeeRequest validation.
     *
     * @return array<int, array{
     *     name: string,
     *     email: string|null,
     *     access_role: string|null,
     *     employee_role: 'employee'|'captain'|'manager',
     *     phone: string,
     *     shift: string,
     *     base_salary: float,
     *     commission_rate: float,
     *     hire_date: string
     * }>
     */
    private function staff(): array
    {
        return [
            [
                'name' => 'Gym Operations Manager',
                'email' => 'operations.manager@gym.test',
                'access_role' => FoundationPermissions::ROLE_MANAGER,
                'employee_role' => 'manager',
                'phone' => '+201011110001',
                'shift' => 'Flexible Admin Shift',
                'base_salary' => 12000.00,
                'commission_rate' => 0.0000,
                'hire_date' => '2026-01-05',
            ],
            [
                'name' => 'Front Desk Receptionist',
                'email' => 'frontdesk@gym.test',
                'access_role' => FoundationPermissions::ROLE_CASHIER,
                'employee_role' => 'employee',
                'phone' => '+201011110002',
                'shift' => 'Opening Shift',
                'base_salary' => 5200.00,
                'commission_rate' => 0.0200,
                'hire_date' => '2026-01-12',
            ],
            [
                'name' => 'Membership Sales Advisor',
                'email' => 'membership.advisor@gym.test',
                'access_role' => FoundationPermissions::ROLE_CASHIER,
                'employee_role' => 'employee',
                'phone' => '+201011110003',
                'shift' => 'Evening Shift',
                'base_salary' => 6000.00,
                'commission_rate' => 0.0500,
                'hire_date' => '2026-02-01',
            ],
            [
                'name' => 'Head Fitness Captain',
                'email' => 'head.captain@gym.test',
                'access_role' => FoundationPermissions::ROLE_CAPTAIN,
                'employee_role' => 'captain',
                'phone' => '+201011110004',
                'shift' => 'Midday Shift',
                'base_salary' => 9000.00,
                'commission_rate' => 0.1000,
                'hire_date' => '2026-01-20',
            ],
            [
                'name' => 'Personal Trainer',
                'email' => 'personal.trainer@gym.test',
                'access_role' => FoundationPermissions::ROLE_CAPTAIN,
                'employee_role' => 'captain',
                'phone' => '+201011110005',
                'shift' => 'Evening Shift',
                'base_salary' => 7600.00,
                'commission_rate' => 0.1200,
                'hire_date' => '2026-02-10',
            ],
            [
                'name' => 'Nutrition Coach',
                'email' => 'nutrition.coach@gym.test',
                'access_role' => FoundationPermissions::ROLE_CAPTAIN,
                'employee_role' => 'captain',
                'phone' => '+201011110006',
                'shift' => 'Midday Shift',
                'base_salary' => 7800.00,
                'commission_rate' => 0.0800,
                'hire_date' => '2026-02-18',
            ],
            [
                'name' => 'Group Class Instructor',
                'email' => 'group.instructor@gym.test',
                'access_role' => FoundationPermissions::ROLE_CAPTAIN,
                'employee_role' => 'captain',
                'phone' => '+201011110007',
                'shift' => 'Weekend Shift',
                'base_salary' => 6800.00,
                'commission_rate' => 0.0700,
                'hire_date' => '2026-03-01',
            ],
            [
                'name' => 'Gym Accountant',
                'email' => 'gym.accountant@gym.test',
                'access_role' => FoundationPermissions::ROLE_ACCOUNTANT,
                'employee_role' => 'employee',
                'phone' => '+201011110008',
                'shift' => 'Flexible Admin Shift',
                'base_salary' => 8500.00,
                'commission_rate' => 0.0000,
                'hire_date' => '2026-01-15',
            ],
            [
                'name' => 'Payroll Officer',
                'email' => 'payroll.officer@gym.test',
                'access_role' => FoundationPermissions::ROLE_ACCOUNTANT,
                'employee_role' => 'employee',
                'phone' => '+201011110009',
                'shift' => 'Flexible Admin Shift',
                'base_salary' => 7200.00,
                'commission_rate' => 0.0000,
                'hire_date' => '2026-03-05',
            ],
            [
                'name' => 'Inventory Coordinator',
                'email' => 'inventory.coordinator@gym.test',
                'access_role' => FoundationPermissions::ROLE_CASHIER,
                'employee_role' => 'employee',
                'phone' => '+201011110010',
                'shift' => 'Opening Shift',
                'base_salary' => 5800.00,
                'commission_rate' => 0.0000,
                'hire_date' => '2026-03-10',
            ],
            [
                'name' => 'Maintenance Technician',
                'email' => null,
                'access_role' => null,
                'employee_role' => 'employee',
                'phone' => '+201011110011',
                'shift' => 'Midday Shift',
                'base_salary' => 5400.00,
                'commission_rate' => 0.0000,
                'hire_date' => '2026-04-01',
            ],
            [
                'name' => 'Cleaning Attendant',
                'email' => null,
                'access_role' => null,
                'employee_role' => 'employee',
                'phone' => '+201011110012',
                'shift' => 'Opening Shift',
                'base_salary' => 4300.00,
                'commission_rate' => 0.0000,
                'hire_date' => '2026-04-08',
            ],
            [
                'name' => 'Night Security Officer',
                'email' => null,
                'access_role' => null,
                'employee_role' => 'employee',
                'phone' => '+201011110013',
                'shift' => 'Night Security Shift',
                'base_salary' => 5000.00,
                'commission_rate' => 0.0000,
                'hire_date' => '2026-04-15',
            ],
        ];
    }
}
