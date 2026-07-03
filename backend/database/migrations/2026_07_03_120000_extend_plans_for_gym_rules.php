<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table): void {
            $table->string('category', 40)->default('gym_access')->after('type')->index();
            $table->boolean('is_unlimited_sessions')->default(false)->after('sessions_count');
            $table->time('access_starts_at')->nullable()->after('valid_to');
            $table->time('access_ends_at')->nullable()->after('access_starts_at');
            $table->unsignedInteger('min_freeze_days')->default(0)->after('max_freeze_days');
            $table->boolean('freeze_requires_approval')->default(false)->after('min_freeze_days');
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->unsignedInteger('sessions_total')->nullable()->after('discount');
            $table->unsignedInteger('sessions_remaining')->nullable()->after('sessions_total');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->dropColumn(['sessions_total', 'sessions_remaining']);
        });

        Schema::table('plans', function (Blueprint $table): void {
            $table->dropColumn([
                'category',
                'is_unlimited_sessions',
                'access_starts_at',
                'access_ends_at',
                'min_freeze_days',
                'freeze_requires_approval',
            ]);
        });
    }
};
