<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Root database seeder.
 *
 * Seeds only the access matrix and stable login users. Business data such as
 * members, products, sales, shifts, finance, and demo scenarios is intentionally
 * excluded so local flow testing starts from an empty operational database.
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
    }
}
