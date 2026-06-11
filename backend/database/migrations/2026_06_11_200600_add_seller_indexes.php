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
        Schema::table('sales', function (Blueprint $table): void {
            $table->index('sold_by_user_id');
            $table->dropIndex(['sold_by_user_id', 'created_at']);
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            // We can drop it, but if it's the foreign key index, MySQL might complain too.
            // Let's index it first just in case, or drop it safely.
            $table->index('sold_by_user_id', 'subscriptions_sold_by_user_id_foreign_idx');
            $table->dropIndex(['sold_by_user_id']);
        });
    }
};
