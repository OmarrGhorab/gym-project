<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll', function (Blueprint $table): void {
            $table->decimal('attendance_deductions', 10, 2)->default(0.00)->after('deductions');
            $table->json('attendance_snapshot')->nullable()->after('attendance_deductions');
        });
    }

    public function down(): void
    {
        Schema::table('payroll', function (Blueprint $table): void {
            $table->dropColumn(['attendance_deductions', 'attendance_snapshot']);
        });
    }
};
