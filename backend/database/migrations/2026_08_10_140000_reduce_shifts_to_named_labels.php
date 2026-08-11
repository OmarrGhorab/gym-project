<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shifts become names, not schedules.
 *
 * "Morning" and "Evening" stay as the label a desk session and an attendance
 * record are filed under, but they no longer say when anybody must be at work.
 * Staff clock in and out whenever they actually arrive and leave, so lateness,
 * early leave, off-shift detection, off-day rotations and overtime coverage all
 * lose their meaning and go with the times that defined them.
 *
 * The cash desk is untouched: shift_sessions keeps its employee_shift_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Both columns were indexed; SQLite refuses to drop a column an index
        // still names, so the indexes go first.
        Schema::table('attendance', function (Blueprint $table): void {
            $table->dropIndex('attendance_schedule_status_index');
            $table->dropIndex('attendance_approval_status_index');
        });

        Schema::table('attendance', function (Blueprint $table): void {
            $table->dropColumn([
                'schedule_status',
                'approval_status',
                'late_minutes',
                'early_leave_minutes',
            ]);
        });

        Schema::table('employee_shifts', function (Blueprint $table): void {
            $table->dropColumn(['starts_at', 'ends_at', 'grace_minutes', 'off_days']);
        });

        Schema::dropIfExists('overtime_shifts');
        Schema::dropIfExists('employee_off_day_overrides');
        Schema::dropIfExists('shift_off_rotations');
    }

    public function down(): void
    {
        Schema::table('employee_shifts', function (Blueprint $table): void {
            $table->time('starts_at')->default('09:00:00')->after('name');
            $table->time('ends_at')->default('17:00:00')->after('starts_at');
            $table->unsignedSmallInteger('grace_minutes')->default(15)->after('ends_at');
            $table->json('off_days')->nullable()->after('grace_minutes');
        });

        Schema::table('attendance', function (Blueprint $table): void {
            $table->string('schedule_status', 30)->nullable()->after('scan_method')->index();
            $table->string('approval_status', 30)->default('approved')->after('schedule_status')->index();
            $table->unsignedInteger('late_minutes')->default(0)->after('approval_status');
            $table->unsignedInteger('early_leave_minutes')->default(0)->after('late_minutes');
        });

        Schema::create('shift_off_rotations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_shift_id')->constrained('employee_shifts')->cascadeOnDelete();
            $table->unsignedTinyInteger('off_weekday');
            $table->date('rotation_start_date');
            $table->json('employee_order');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('employee_shift_id');
        });

        Schema::create('employee_off_day_overrides', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('date');
            $table->string('type', 10);
            $table->string('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['employee_id', 'date']);
            $table->index('date');
        });

        Schema::create('overtime_shifts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('covering_for_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('employee_shift_id')->nullable()->constrained('employee_shifts')->nullOnDelete();
            $table->date('date');
            $table->time('starts_at')->nullable();
            $table->time('ends_at')->nullable();
            $table->decimal('hours', 5, 2)->nullable();
            $table->decimal('bonus_amount', 12, 2)->default(0);
            $table->string('status', 20)->default('pending');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('settled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();

            $table->index(['date', 'status']);
            $table->index(['employee_id', 'date']);
            $table->index('covering_for_employee_id');
            $table->unique(['employee_id', 'date', 'employee_shift_id'], 'overtime_shifts_employee_date_shift_unique');
        });
    }
};
