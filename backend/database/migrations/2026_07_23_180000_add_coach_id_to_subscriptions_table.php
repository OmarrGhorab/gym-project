<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->foreignId('coach_id')
                ->nullable()
                ->after('plan_id')
                ->constrained('employees')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->dropForeign(['coach_id']);
            $table->dropColumn('coach_id');
        });
    }
};
