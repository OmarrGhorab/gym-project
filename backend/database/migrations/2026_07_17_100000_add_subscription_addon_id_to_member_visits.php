<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_visits', function (Blueprint $table): void {
            $table->foreignId('subscription_addon_id')
                ->nullable()
                ->after('subscription_id')
                ->constrained('subscription_addons')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('member_visits', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('subscription_addon_id');
        });
    }
};
