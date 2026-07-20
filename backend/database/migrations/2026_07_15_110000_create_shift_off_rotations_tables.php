<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
            $table->string('type', 10); // off | work
            $table->string('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['employee_id', 'date']);
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_off_day_overrides');
        Schema::dropIfExists('shift_off_rotations');
    }
};
