<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('password_reset_otps', function (Blueprint $table): void {
            $table->unsignedTinyInteger('attempts')->default(0)->after('expires_at');
        });

        Schema::table('email_verification_otps', function (Blueprint $table): void {
            $table->unsignedTinyInteger('attempts')->default(0)->after('expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('password_reset_otps', function (Blueprint $table): void {
            $table->dropColumn('attempts');
        });

        Schema::table('email_verification_otps', function (Blueprint $table): void {
            $table->dropColumn('attempts');
        });
    }
};
