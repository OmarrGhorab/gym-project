<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Root database seeder.
 *
 * Seeds roles/permissions, stable role logins (admin/manager/etc.), shifts,
 * attendance violation rules/settings, and staff.
 * Does not seed members, plans, products, sales, revenue, or other operational demo data.
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Access matrix (roles + permissions)
        $this->call(FoundationAccessSeeder::class);
        $this->call(MembershipAccessSeeder::class);
        $this->call(PosAccessSeeder::class);
        $this->call(HrFinanceAccessSeeder::class);
        $this->call(RoleMatrixSeeder::class);

        // One login user per role (admin@gym.test, manager@gym.test, ...)
        $this->call(RoleUserSeeder::class);

        // Staff roster + attendance rules (no members/plans/revenue)
        $this->call(EmployeeShiftSeeder::class);
        $this->call(AttendanceRulesSeeder::class);
        $this->call(GymStaffSeeder::class);
    }
}
