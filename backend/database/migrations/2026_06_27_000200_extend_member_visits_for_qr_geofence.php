<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_visits', function (Blueprint $table): void {
            $table->string('scan_method', 20)->default('manual')->after('status');
            $table->decimal('check_in_latitude', 10, 7)->nullable()->after('check_in_at');
            $table->decimal('check_in_longitude', 10, 7)->nullable()->after('check_in_latitude');
            $table->unsignedInteger('check_in_accuracy_meters')->nullable()->after('check_in_longitude');
            $table->unsignedInteger('check_in_distance_meters')->nullable()->after('check_in_accuracy_meters');
            $table->string('check_in_location_status', 20)->nullable()->after('check_in_distance_meters');
            $table->decimal('check_out_latitude', 10, 7)->nullable()->after('check_out_at');
            $table->decimal('check_out_longitude', 10, 7)->nullable()->after('check_out_latitude');
            $table->unsignedInteger('check_out_accuracy_meters')->nullable()->after('check_out_longitude');
            $table->unsignedInteger('check_out_distance_meters')->nullable()->after('check_out_accuracy_meters');
            $table->string('check_out_location_status', 20)->nullable()->after('check_out_distance_meters');
            $table->index(['scan_method', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('member_visits', function (Blueprint $table): void {
            $table->dropIndex(['scan_method', 'status']);
            $table->dropColumn([
                'scan_method',
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
