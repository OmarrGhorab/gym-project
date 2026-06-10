<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 150);
            $table->string('phone', 30)->index();
            $table->string('email', 150)->nullable()->unique();
            $table->string('gender', 10)->nullable();
            $table->date('birth_date')->nullable();
            $table->string('photo_path', 255)->nullable();
            $table->string('national_id', 50)->nullable()->unique();
            $table->date('join_date')->default(now()->toDateString());
            $table->string('status', 20)->default('active')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('members');
    }
};
