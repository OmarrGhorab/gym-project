<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operations_calendar_events', function (Blueprint $table): void {
            $table->json('assigned_employee_ids')->nullable()->after('assigned_employee_id');
            $table->string('custom_type_label', 120)->nullable()->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('operations_calendar_events', function (Blueprint $table): void {
            $table->dropColumn(['assigned_employee_ids', 'custom_type_label']);
        });
    }
};
