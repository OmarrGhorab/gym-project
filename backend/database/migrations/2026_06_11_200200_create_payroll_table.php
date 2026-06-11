<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')
                ->constrained('employees')
                ->restrictOnDelete();
            $table->char('month', 7); // YYYY-MM
            $table->decimal('base_salary', 10, 2);
            $table->decimal('commissions_total', 10, 2)->default(0.00);
            $table->decimal('bonuses', 10, 2)->default(0.00);
            $table->decimal('deductions', 10, 2)->default(0.00);
            $table->decimal('net_salary', 10, 2);
            $table->string('status', 20)->default('pending');
            $table->dateTime('paid_at')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'month']);
            $table->index(['month', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll');
    }
};
