<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_shifts', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->time('starts_at');
            $table->time('ends_at');
            $table->unsignedSmallInteger('grace_minutes')->default(15);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::table('employees', function (Blueprint $table): void {
            $table->foreignId('shift_id')
                ->nullable()
                ->after('commission_rate')
                ->constrained('employee_shifts')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('shift_id');
        });

        Schema::dropIfExists('employee_shifts');
    }
};
