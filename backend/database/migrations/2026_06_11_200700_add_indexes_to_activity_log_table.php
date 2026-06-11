<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_log', function (Blueprint $table): void {
            $indexes = Schema::getIndexes('activity_log');
            $indexNames = collect($indexes)->pluck('name')->toArray();

            if (! in_array('activity_log_created_at_index', $indexNames, true)) {
                $table->index(['created_at']);
            }

            if (! in_array('activity_log_causer_id_created_at_index', $indexNames, true)) {
                $table->index(['causer_id', 'created_at']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('activity_log', function (Blueprint $table): void {
            $indexes = Schema::getIndexes('activity_log');
            $indexNames = collect($indexes)->pluck('name')->toArray();

            if (in_array('activity_log_created_at_index', $indexNames, true)) {
                $table->dropIndex(['created_at']);
            }

            if (in_array('activity_log_causer_id_created_at_index', $indexNames, true)) {
                $table->dropIndex(['causer_id', 'created_at']);
            }
        });
    }
};
