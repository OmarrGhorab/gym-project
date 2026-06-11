<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')
                ->nullable()
                ->unique()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('name', 255);
            $table->string('phone', 30)->nullable();
            $table->string('role', 20)->default('employee')->index();
            $table->decimal('base_salary', 10, 2)->default(0.00);
            $table->decimal('commission_rate', 5, 4)->default(0.0000);
            $table->date('hire_date')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
