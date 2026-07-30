<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_visits', function (Blueprint $table): void {
            $table->foreignId('reviewed_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->index(['status', 'check_in_at']);
        });
    }

    public function down(): void
    {
        Schema::table('member_visits', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn('reviewed_at');
            $table->dropIndex(['status', 'check_in_at']);
        });
    }
};
