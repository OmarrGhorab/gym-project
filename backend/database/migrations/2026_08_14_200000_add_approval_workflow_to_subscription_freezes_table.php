<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_freezes', function (Blueprint $table): void {
            $table->string('approval_status', 20)
                ->default('not_required')
                ->after('approved_at')
                ->index();
            $table->foreignId('dismissed_by')
                ->nullable()
                ->after('approval_status')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('dismissed_at')->nullable()->after('dismissed_by');
        });

        DB::table('subscription_freezes')
            ->whereNotNull('approved_at')
            ->update(['approval_status' => 'approved']);
    }

    public function down(): void
    {
        Schema::table('subscription_freezes', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('dismissed_by');
            $table->dropIndex(['approval_status']);
            $table->dropColumn(['approval_status', 'dismissed_at']);
        });
    }
};
