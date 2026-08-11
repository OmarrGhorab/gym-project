<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Plans flagged `freeze_requires_approval` used to be un-freezable: the action
     * threw unconditionally and no approval path existed. Freezing such a plan now
     * requires the `subscriptions.freeze_approve` permission, and these columns keep
     * the sign-off auditable (who approved, when).
     */
    public function up(): void
    {
        Schema::table('subscription_freezes', function (Blueprint $table): void {
            $table->foreignId('approved_by')
                ->nullable()
                ->after('created_by')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_freezes', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn('approved_at');
        });
    }
};
