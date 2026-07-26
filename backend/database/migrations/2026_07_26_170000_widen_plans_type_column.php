<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `plans.type` was varchar(20), but `membership_extra_service` is 24 characters —
 * so creating a plan of that type failed with a truncation error on MySQL. The
 * test suite runs on SQLite, which does not enforce varchar length, which is why
 * this went unnoticed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table): void {
            $table->string('type', 40)->change();
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table): void {
            $table->string('type', 20)->change();
        });
    }
};
