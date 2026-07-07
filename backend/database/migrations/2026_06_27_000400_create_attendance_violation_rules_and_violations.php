<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_violation_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 80)->unique();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('threshold_minutes')->nullable();
            $table->unsignedSmallInteger('warning_count_before_deduction')->default(0);
            $table->decimal('deduction_days', 6, 2)->default(0.00);
            $table->boolean('requires_admin_approval')->default(true);
            $table->boolean('auto_apply_if_unreviewed')->default(true);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('attendance_violations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')
                ->constrained('employees')
                ->cascadeOnDelete();
            $table->foreignId('attendance_id')
                ->nullable()
                ->constrained('attendance')
                ->nullOnDelete();
            $table->foreignId('attendance_violation_rule_id')
                ->nullable()
                ->constrained('attendance_violation_rules')
                ->nullOnDelete();
            $table->foreignId('payroll_id')
                ->nullable()
                ->constrained('payroll')
                ->nullOnDelete();
            $table->date('violation_date');
            $table->string('type', 40)->index();
            $table->unsignedInteger('minutes')->nullable();
            $table->decimal('deduction_days', 6, 2)->default(0.00);
            $table->decimal('deduction_amount', 10, 2)->default(0.00);
            $table->string('status', 30)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'violation_date']);
            $table->index(['payroll_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_violations');
        Schema::dropIfExists('attendance_violation_rules');
    }
};
