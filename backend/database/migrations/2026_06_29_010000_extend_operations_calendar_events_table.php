<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operations_calendar_events', function (Blueprint $table): void {
            $table->dateTime('starts_at')->nullable()->after('date');
            $table->dateTime('ends_at')->nullable()->after('starts_at');
            $table->boolean('all_day')->default(true)->after('ends_at');
            $table->string('status', 40)->default('scheduled')->after('type')->index();
            $table->foreignId('assigned_employee_id')
                ->nullable()
                ->after('status')
                ->constrained('employees')
                ->nullOnDelete();
            $table->string('location', 191)->nullable()->after('assigned_employee_id');
        });
    }

    public function down(): void
    {
        Schema::table('operations_calendar_events', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('assigned_employee_id');
            $table->dropColumn(['starts_at', 'ends_at', 'all_day', 'status', 'location']);
        });
    }
};
