<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table): void {
            $table->string('emergency_contact_name', 150)->nullable()->after('national_id');
            $table->string('emergency_contact_phone', 30)->nullable()->after('emergency_contact_name');
            $table->text('goals')->nullable()->after('notes');
            $table->text('injuries')->nullable()->after('goals');
            $table->text('medical_notes')->nullable()->after('injuries');
            $table->json('tags')->nullable()->after('medical_notes');
            $table->foreignId('coach_id')
                ->nullable()
                ->after('tags')
                ->constrained('employees')
                ->nullOnDelete();

            $table->index('coach_id');
        });
    }

    public function down(): void
    {
        Schema::table('members', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('coach_id');
            $table->dropColumn([
                'emergency_contact_name',
                'emergency_contact_phone',
                'goals',
                'injuries',
                'medical_notes',
                'tags',
            ]);
        });
    }
};
