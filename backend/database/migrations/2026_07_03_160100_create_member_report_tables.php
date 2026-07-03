<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_progress_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->date('recorded_on');
            $table->decimal('weight_kg', 6, 2)->nullable();
            $table->decimal('body_fat_percent', 5, 2)->nullable();
            $table->decimal('chest_cm', 6, 2)->nullable();
            $table->decimal('waist_cm', 6, 2)->nullable();
            $table->decimal('hips_cm', 6, 2)->nullable();
            $table->decimal('arms_cm', 6, 2)->nullable();
            $table->decimal('thighs_cm', 6, 2)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['member_id', 'recorded_on']);
        });

        Schema::create('member_workout_plans', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('coach_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('title', 150);
            $table->string('status', 20)->default('active')->index();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->json('sessions')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['member_id', 'status']);
        });

        Schema::create('member_nutrition_plans', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('coach_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('title', 150);
            $table->string('status', 20)->default('active')->index();
            $table->unsignedSmallInteger('daily_calories')->nullable();
            $table->unsignedSmallInteger('protein_grams')->nullable();
            $table->unsignedSmallInteger('carbs_grams')->nullable();
            $table->unsignedSmallInteger('fat_grams')->nullable();
            $table->text('supplements')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['member_id', 'status']);
        });

        Schema::create('member_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->string('type', 40)->index();
            $table->string('title', 150);
            $table->string('file_path', 255)->nullable();
            $table->date('expires_on')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['member_id', 'type']);
        });

        Schema::create('member_bookings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('coach_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('title', 150);
            $table->string('type', 30)->default('session')->index();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->string('status', 20)->default('scheduled')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['member_id', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_bookings');
        Schema::dropIfExists('member_documents');
        Schema::dropIfExists('member_nutrition_plans');
        Schema::dropIfExists('member_workout_plans');
        Schema::dropIfExists('member_progress_entries');
    }
};
