<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_plan_commission_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')
                ->constrained('employees')
                ->cascadeOnDelete();
            $table->foreignId('plan_id')
                ->nullable()
                ->constrained('plans')
                ->cascadeOnDelete();
            $table->string('calculation_type', 20)->default('fixed');
            $table->decimal('value', 10, 4)->default('0.0000');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['employee_id', 'plan_id']);
            $table->index(['employee_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_plan_commission_rules');
    }
};
