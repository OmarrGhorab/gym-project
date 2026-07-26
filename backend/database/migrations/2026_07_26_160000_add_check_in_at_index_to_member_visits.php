<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('member_visits')) {
            return;
        }

        Schema::table('member_visits', function (Blueprint $table): void {
            $indexNames = collect(Schema::getIndexes('member_visits'))->pluck('name')->all();

            if (! in_array('member_visits_check_in_at_index', $indexNames, true)) {
                $table->index('check_in_at', 'member_visits_check_in_at_index');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('member_visits')) {
            return;
        }

        Schema::table('member_visits', function (Blueprint $table): void {
            $indexNames = collect(Schema::getIndexes('member_visits'))->pluck('name')->all();

            if (in_array('member_visits_check_in_at_index', $indexNames, true)) {
                $table->dropIndex('member_visits_check_in_at_index');
            }
        });
    }
};
