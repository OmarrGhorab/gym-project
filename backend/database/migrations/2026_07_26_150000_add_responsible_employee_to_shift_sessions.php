<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A shift session is owned by an employee of that shift, not by whichever user
 * account happened to trigger it. opened_by/closed_by stay as the audit trail of
 * the acting user (an admin may act on the employee's behalf).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('shift_sessions', 'opened_by_employee_id')) {
            Schema::table('shift_sessions', function (Blueprint $table): void {
                $table->foreignId('opened_by_employee_id')
                    ->nullable()
                    ->after('opened_by')
                    ->constrained('employees')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('shift_sessions', 'closed_by_employee_id')) {
            Schema::table('shift_sessions', function (Blueprint $table): void {
                $table->foreignId('closed_by_employee_id')
                    ->nullable()
                    ->after('closed_by')
                    ->constrained('employees')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('shift_sessions', 'closed_by_employee_id')) {
            Schema::table('shift_sessions', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('closed_by_employee_id');
            });
        }

        if (Schema::hasColumn('shift_sessions', 'opened_by_employee_id')) {
            Schema::table('shift_sessions', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('opened_by_employee_id');
            });
        }
    }
};
