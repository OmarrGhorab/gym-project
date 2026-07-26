<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('overtime_shifts')) {
            return;
        }

        Schema::create('overtime_shifts', function (Blueprint $table): void {
            $table->id();
            // Employee working the extra shift.
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            // Absent colleague being covered (kept for history even if the employee record is removed).
            $table->foreignId('covering_for_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('employee_shift_id')->nullable()->constrained('employee_shifts')->nullOnDelete();
            $table->date('date');
            $table->time('starts_at')->nullable();
            $table->time('ends_at')->nullable();
            $table->decimal('hours', 5, 2)->nullable();
            // Bonus is entered by hand at review time — never auto-computed into payroll.
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

    public function down(): void
    {
        Schema::dropIfExists('overtime_shifts');
    }
};
