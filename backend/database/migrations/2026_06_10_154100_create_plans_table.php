<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->unsignedInteger('duration_days');
            $table->unsignedInteger('sessions_count')->nullable();
            $table->string('type', 20)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            $table->unsignedInteger('max_freeze_days')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
