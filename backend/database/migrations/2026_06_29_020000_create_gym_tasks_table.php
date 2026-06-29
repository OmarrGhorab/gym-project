<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gym_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('title', 191);
            $table->text('description')->nullable();
            $table->string('status', 40)->default('planned')->index();
            $table->string('priority', 20)->default('medium')->index();
            $table->string('category', 40)->default('operations')->index();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->date('due_date')->nullable()->index();
            $table->foreignId('assigned_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gym_tasks');
    }
};
