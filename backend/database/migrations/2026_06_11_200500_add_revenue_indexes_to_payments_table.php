<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->index(['status', 'paid_at']);
            $table->index(['payable_type', 'payable_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropIndex(['status', 'paid_at']);
            $table->dropIndex(['payable_type', 'payable_id', 'status']);
        });
    }
};
