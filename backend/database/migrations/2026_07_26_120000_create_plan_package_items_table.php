<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plan_package_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('package_plan_id')->constrained('plans')->cascadeOnDelete();
            $table->foreignId('included_plan_id')->constrained('plans')->restrictOnDelete();
            $table->foreignId('coach_id')->constrained('employees')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['package_plan_id', 'included_plan_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_package_items');
    }
};
