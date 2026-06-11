<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->index(['sold_by_user_id', 'created_at']);
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->index(['sold_by_user_id']);
        });
    }

    public function down(): void
    {
        // Drop exactly what up() added — nothing else. The FK-backing indexes
        // created by Phase 1/2 `constrained()` are left intact.
        Schema::table('sales', function (Blueprint $table): void {
            $table->dropIndex(['sold_by_user_id', 'created_at']);
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->dropIndex(['sold_by_user_id']);
        });
    }
};
