<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table): void {
            $table->foreignId('shift_id')
                ->nullable()
                ->after('employee_id')
                ->constrained('employee_shifts')
                ->nullOnDelete();
            $table->string('scan_method', 20)->default('manual')->after('status');
            $table->string('schedule_status', 30)->nullable()->after('scan_method')->index();
            $table->string('approval_status', 30)->default('approved')->after('schedule_status')->index();
            $table->unsignedInteger('late_minutes')->default(0)->after('approval_status');
            $table->unsignedInteger('early_leave_minutes')->default(0)->after('late_minutes');
            $table->decimal('check_in_latitude', 10, 7)->nullable()->after('check_in');
            $table->decimal('check_in_longitude', 10, 7)->nullable()->after('check_in_latitude');
            $table->unsignedInteger('check_in_accuracy_meters')->nullable()->after('check_in_longitude');
            $table->unsignedInteger('check_in_distance_meters')->nullable()->after('check_in_accuracy_meters');
            $table->string('check_in_location_status', 20)->nullable()->after('check_in_distance_meters');
            $table->decimal('check_out_latitude', 10, 7)->nullable()->after('check_out');
            $table->decimal('check_out_longitude', 10, 7)->nullable()->after('check_out_latitude');
            $table->unsignedInteger('check_out_accuracy_meters')->nullable()->after('check_out_longitude');
            $table->unsignedInteger('check_out_distance_meters')->nullable()->after('check_out_accuracy_meters');
            $table->string('check_out_location_status', 20)->nullable()->after('check_out_distance_meters');
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('shift_id');
            $table->dropColumn([
                'scan_method',
                'schedule_status',
                'approval_status',
                'late_minutes',
                'early_leave_minutes',
                'check_in_latitude',
                'check_in_longitude',
                'check_in_accuracy_meters',
                'check_in_distance_meters',
                'check_in_location_status',
                'check_out_latitude',
                'check_out_longitude',
                'check_out_accuracy_meters',
                'check_out_distance_meters',
                'check_out_location_status',
            ]);
        });
    }
};
