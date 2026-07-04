<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Root database seeder.
 *
 * Seeds the access matrix, stable login users, and the default gym catalog
 * (membership plans and retail products). Business data such as members,
 * sales, shifts, finance, and demo scenarios remains in dedicated seeders.
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
        $this->call(PlanSeeder::class);
        $this->call(ProductSeeder::class);
    }
}
