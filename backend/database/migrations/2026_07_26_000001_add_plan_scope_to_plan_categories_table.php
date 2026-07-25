<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plan_categories', function (Blueprint $table): void {
            $table->string('plan_scope', 30)->default('gym_access')->after('slug');
        });
    }

    public function down(): void
    {
        Schema::table('plan_categories', function (Blueprint $table): void {
            $table->dropColumn('plan_scope');
        });
    }
};
