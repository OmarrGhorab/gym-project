<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_freezes', function (Blueprint $table): void {
            $table->date('resumed_on')->nullable()->after('freeze_end');
            $table->unsignedInteger('remaining_days_at_freeze')->nullable()->after('days');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_freezes', function (Blueprint $table): void {
            $table->dropColumn(['resumed_on', 'remaining_days_at_freeze']);
        });
    }
};
