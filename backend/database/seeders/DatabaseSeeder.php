<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Root database seeder.
 *
 * Only calls shared infrastructure seeders. Business-module seed data is
 * added by later phases in their own seeders, called from here.
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

        if (! (bool) env('SEED_DEMO_DATA', false)) {
            return;
        }

        $this->call(AttendanceRulesSeeder::class);
        $this->call(PostmanScenarioSeeder::class);
        $this->call(DashboardDemoSeeder::class);
        $this->call(FinanceOverviewSeeder::class);
        $this->call(SalesActivitySeeder::class);
    }
}
