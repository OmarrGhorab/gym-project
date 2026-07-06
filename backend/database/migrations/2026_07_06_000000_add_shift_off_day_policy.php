<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_shifts', function (Blueprint $table): void {
            $table->json('off_days')->nullable()->after('grace_minutes');
            $table->boolean('off_day_bonus_enabled')->default(false)->after('off_days');
            $table->decimal('off_day_bonus_amount', 10, 2)->default(0)->after('off_day_bonus_enabled');
        });

        Schema::table('attendance', function (Blueprint $table): void {
            $table->decimal('off_day_bonus_amount', 10, 2)->default(0)->after('early_leave_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table): void {
            $table->dropColumn('off_day_bonus_amount');
        });

        Schema::table('employee_shifts', function (Blueprint $table): void {
            $table->dropColumn(['off_days', 'off_day_bonus_enabled', 'off_day_bonus_amount']);
        });
    }
};
