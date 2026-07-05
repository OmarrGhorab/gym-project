<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Root database seeder.
 *
 * Seeds the access matrix, stable login users, default staff shifts, baseline
 * gym employees, and the default gym catalog (membership plans and retail
 * products). Larger business/demo datasets remain in dedicated seeders.
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(FoundationAccessSeeder::class);
        $this->call(MembershipAccessSeeder::class);
        $this->call(PosAccessSeeder::class);
        $this->call(HrFinanceAccessSeeder::class);
        $this->call(RoleMatrixSeeder::class);
        $this->call(RoleUserSeeder::class);
        $this->call(EmployeeShiftSeeder::class);
        $this->call(AttendanceRulesSeeder::class);
        $this->call(GymStaffSeeder::class);
        $this->call(PlanSeeder::class);
        $this->call(MembershipDemoSeeder::class);
        $this->call(ProductSeeder::class);
        $this->call(PostmanScenarioSeeder::class);
    }
}
