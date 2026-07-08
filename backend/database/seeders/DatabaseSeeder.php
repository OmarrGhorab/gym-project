<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Root database seeder.
 *
 * Seeds the essential access setup, stable login users, membership plans,
 * realistic staff accounts, and attendance rules.
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(CleanOperationalDataSeeder::class);
        $this->call(FoundationAccessSeeder::class);
        $this->call(MembershipAccessSeeder::class);
        $this->call(PosAccessSeeder::class);
        $this->call(HrFinanceAccessSeeder::class);
        $this->call(RoleMatrixSeeder::class);
        $this->call(RoleUserSeeder::class);
        $this->call(EmployeeShiftSeeder::class);
        $this->call(AttendanceRulesSeeder::class);
        $this->call(PlanSeeder::class);
        $this->call(GymStaffSeeder::class);
        $this->call(PlanEmployeeCommissionSeeder::class);
        $this->call(MemberSeeder::class);
        $this->call(MemberReportDemoSeeder::class);
        $this->call(ProductSeeder::class);
    }
}
