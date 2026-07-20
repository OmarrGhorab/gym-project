<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class GymStaffSeeder extends Seeder
{
    /**
     * Seed staff for testing sell / renew / shift desk:
     * - Multiple cashiers on each of the 4 desk shifts (Cashier role)
     * - Manager + accountant + a few coaches
     *
     * All logins use password: password
     */
    public function run(): void
    {
        $cashierRole = Role::findByName(FoundationPermissions::ROLE_CASHIER, 'web');
        $managerRole = Role::findByName(FoundationPermissions::ROLE_MANAGER, 'web');
        $accountantRole = Role::findByName(FoundationPermissions::ROLE_ACCOUNTANT, 'web');
        $captainRole = Role::findByName(FoundationPermissions::ROLE_CAPTAIN, 'web');

        DB::transaction(function () use ($cashierRole, $managerRole, $accountantRole, $captainRole): void {
            foreach (self::staffRecords() as $staffMember) {
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

                    $roleName = $staffMember['login_role'] ?? null;
                    if ($roleName === FoundationPermissions::ROLE_CASHIER) {
                        $user->syncRoles([$cashierRole->name]);
                    } elseif ($roleName === FoundationPermissions::ROLE_MANAGER) {
                        $user->syncRoles([$managerRole->name]);
                    } elseif ($roleName === FoundationPermissions::ROLE_ACCOUNTANT) {
                        $user->syncRoles([$accountantRole->name]);
                    } elseif ($roleName === FoundationPermissions::ROLE_CAPTAIN) {
                        $user->syncRoles([$captainRole->name]);
                    }
                }

                Employee::query()->updateOrCreate(
                    ['phone' => $staffMember['phone']],
                    [
                        'user_id' => $user?->id,
                        'name' => $staffMember['name'],
                        'role' => $staffMember['employee_role'],
                        'base_salary' => $staffMember['base_salary'] ?? 0,
                        'pay_day' => $staffMember['pay_day'] ?? null,
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
     * @return array<int, array{
     *     name: string,
     *     email: string|null,
     *     login_role: string|null,
     *     employee_role: 'employee'|'captain'|'manager'|'coach',
     *     phone: string,
     *     shift: string,
     *     base_salary?: float,
     *     pay_day?: int|null,
     *     hire_date: string
     * }>
     */
    public static function staffRecords(): array
    {
        $deskShifts = [
            'Morning Desk 06-11' => [
                ['name' => 'Nour Morning A', 'email' => 'morning.cashier1@gym.test', 'phone' => '+201020010001'],
                ['name' => 'Hana Morning B', 'email' => 'morning.cashier2@gym.test', 'phone' => '+201020010002'],
                ['name' => 'Yara Morning C', 'email' => 'morning.cashier3@gym.test', 'phone' => '+201020010003'],
            ],
            'Midday Desk 11-16' => [
                ['name' => 'Karim Midday A', 'email' => 'midday.cashier1@gym.test', 'phone' => '+201020020001'],
                ['name' => 'Laila Midday B', 'email' => 'midday.cashier2@gym.test', 'phone' => '+201020020002'],
                ['name' => 'Tamer Midday C', 'email' => 'midday.cashier3@gym.test', 'phone' => '+201020020003'],
            ],
            'Evening Desk 16-21' => [
                ['name' => 'Salma Evening A', 'email' => 'evening.cashier1@gym.test', 'phone' => '+201020030001'],
                ['name' => 'Omar Evening B', 'email' => 'evening.cashier2@gym.test', 'phone' => '+201020030002'],
                ['name' => 'Dina Evening C', 'email' => 'evening.cashier3@gym.test', 'phone' => '+201020030003'],
            ],
            'Closing Desk 21-00' => [
                ['name' => 'Ramy Closing A', 'email' => 'closing.cashier1@gym.test', 'phone' => '+201020040001'],
                ['name' => 'Mona Closing B', 'email' => 'closing.cashier2@gym.test', 'phone' => '+201020040002'],
                ['name' => 'Fady Closing C', 'email' => 'closing.cashier3@gym.test', 'phone' => '+201020040003'],
            ],
        ];

        $records = [
            [
                'name' => 'Ops Manager',
                'email' => 'operations.manager@gym.test',
                'login_role' => FoundationPermissions::ROLE_MANAGER,
                'employee_role' => 'manager',
                'phone' => '+201011110001',
                'shift' => 'Flexible Admin',
                'base_salary' => 12000,
                'pay_day' => 1,
                'hire_date' => '2026-01-05',
            ],
            [
                'name' => 'Gym Accountant',
                'email' => 'gym.accountant@gym.test',
                'login_role' => FoundationPermissions::ROLE_ACCOUNTANT,
                'employee_role' => 'employee',
                'phone' => '+201011110008',
                'shift' => 'Flexible Admin',
                'base_salary' => 9000,
                'pay_day' => 1,
                'hire_date' => '2026-01-15',
            ],
            [
                'name' => 'Head Captain',
                'email' => 'head.captain@gym.test',
                'login_role' => FoundationPermissions::ROLE_CAPTAIN,
                'employee_role' => 'captain',
                'phone' => '+201011110004',
                'shift' => 'Midday Desk 11-16',
                'base_salary' => 8000,
                'pay_day' => 5,
                'hire_date' => '2026-01-20',
            ],
            [
                'name' => 'Heba Coach',
                'email' => 'personal.trainer@gym.test',
                'login_role' => null,
                'employee_role' => 'coach',
                'phone' => '+201011110005',
                'shift' => 'Evening Desk 16-21',
                'base_salary' => 7000,
                'pay_day' => 5,
                'hire_date' => '2026-02-10',
            ],
            [
                'name' => 'Sara Coach',
                'email' => 'nutrition.coach@gym.test',
                'login_role' => null,
                'employee_role' => 'coach',
                'phone' => '+201011110006',
                'shift' => 'Midday Desk 11-16',
                'base_salary' => 6500,
                'pay_day' => 5,
                'hire_date' => '2026-02-18',
            ],
        ];

        foreach ($deskShifts as $shiftName => $cashiers) {
            foreach ($cashiers as $cashier) {
                $records[] = [
                    'name' => $cashier['name'],
                    'email' => $cashier['email'],
                    'login_role' => FoundationPermissions::ROLE_CASHIER,
                    'employee_role' => 'employee',
                    'phone' => $cashier['phone'],
                    'shift' => $shiftName,
                    'base_salary' => 5500,
                    'pay_day' => 28,
                    'hire_date' => '2026-03-01',
                ];
            }
        }

        // Keep classic cashier@gym.test as an extra floating desk login on midday.
        $records[] = [
            'name' => 'Cashier User',
            'email' => 'cashier@gym.test',
            'login_role' => FoundationPermissions::ROLE_CASHIER,
            'employee_role' => 'employee',
            'phone' => '+201099990003',
            'shift' => 'Midday Desk 11-16',
            'base_salary' => 5500,
            'pay_day' => 28,
            'hire_date' => '2026-03-01',
        ];

        return $records;
    }
}
