<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CleanOperationalDataSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        foreach ($this->tablesToTruncate() as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->truncate();
            }
        }

        Schema::enableForeignKeyConstraints();

        $staffEmails = collect(GymStaffSeeder::staffRecords())
            ->pluck('email')
            ->filter()
            ->values();

        DB::table('users')
            ->when(
                $staffEmails->isNotEmpty(),
                fn ($query) => $query->whereNotIn('email', $staffEmails->all()),
            )
            ->delete();
    }

    /**
     * @return list<string>
     */
    private function tablesToTruncate(): array
    {
        return [
            'model_has_roles',
            'model_has_permissions',
            'role_has_permissions',
            'subscription_addons',
            'subscription_freezes',
            'payments',
            'member_visits',
            'subscriptions',
            'member_bookings',
            'member_documents',
            'member_nutrition_plans',
            'member_workout_plans',
            'member_progress_entries',
            'members',
            'attendance_violations',
            'attendance_violation_rules',
            'attendance',
            'employee_plan_commission_rules',
            'commissions',
            'payroll',
            'expenses',
            'inventory_movements',
            'sale_items',
            'sales',
            'products',
            'plans',
            'employees',
            'settings',
            'notifications',
            'social_accounts',
            'password_reset_otps',
            'email_verification_otps',
            'personal_access_tokens',
            'operations_calendar_events',
            'gym_task_comments',
            'gym_tasks',
            'purchase_orders',
        ];
    }
}
