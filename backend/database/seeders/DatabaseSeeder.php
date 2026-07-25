<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Full application seed for local testing.
 *
 * Includes access matrix, 4 desk shifts (≤5h, 06:00–23:59), cashiers per shift,
 * attendance rules, membership plans, plain members, and POS products.
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

        // One login user per role (admin@gym.test, manager@gym.test, cashier@gym.test, ...)
        $this->call(RoleUserSeeder::class);

        // Shifts (4 desk + flexible admin) + attendance rules + staff cashiers
        $this->call(EmployeeShiftSeeder::class);
        $this->call(AttendanceRulesSeeder::class);
        $this->call(GymStaffSeeder::class);

        // Catalog + members so cashiers can sell/renew subscriptions and POS
        $this->call(PlanCategorySeeder::class);
        $this->call(PlanSeeder::class);
        $this->call(PlanEmployeeCommissionSeeder::class);
        $this->call(ProductSeeder::class);
        $this->call(MemberSeeder::class);
    }
}
