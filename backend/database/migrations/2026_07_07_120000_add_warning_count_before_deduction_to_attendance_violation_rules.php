<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('attendance_violation_rules', 'warning_count_before_deduction')) {
            return;
        }

        Schema::table('attendance_violation_rules', function (Blueprint $table): void {
            $table->unsignedSmallInteger('warning_count_before_deduction')
                ->default(0)
                ->after('threshold_minutes');
        });
    }

    public function down(): void
    {
        // The column is part of the table's create migration in fresh installs.
        // Keep this rollback as a no-op so rolling back this compatibility
        // migration does not remove a column owned by the base schema.
    }
};
