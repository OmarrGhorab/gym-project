<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commissions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')
                ->constrained('employees')
                ->restrictOnDelete();

            // Morphs equivalent with a unique index.
            $table->string('source_type', 150);
            $table->unsignedBigInteger('source_id');
            $table->unique(['source_type', 'source_id']);

            $table->decimal('rate', 5, 4);
            $table->decimal('amount', 10, 2);
            $table->char('month', 7); // YYYY-MM
            $table->string('status', 20)->default('pending');
            $table->timestamps();

            $table->index(['employee_id', 'month', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commissions');
    }
};
