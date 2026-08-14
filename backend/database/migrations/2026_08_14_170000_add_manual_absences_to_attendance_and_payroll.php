<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table): void {
            $table->string('absence_reason', 500)->nullable()->after('notes');
            $table->decimal('absence_deduction_amount', 10, 2)->default(0)->after('absence_reason');
            $table->foreignId('absence_recorded_by')
                ->nullable()
                ->after('absence_deduction_amount')
                ->constrained('users')
                ->nullOnDelete();
        });

        Schema::table('payroll', function (Blueprint $table): void {
            $table->decimal('absence_deductions', 10, 2)->default(0)->after('deductions');
            $table->json('absence_snapshot')->nullable()->after('absence_deductions');
        });
    }

    public function down(): void
    {
        Schema::table('payroll', function (Blueprint $table): void {
            $table->dropColumn(['absence_deductions', 'absence_snapshot']);
        });

        Schema::table('attendance', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('absence_recorded_by');
            $table->dropColumn(['absence_reason', 'absence_deduction_amount']);
        });
    }
};
