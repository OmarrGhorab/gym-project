<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table): void {
            $table->string('attendance_code', 64)->nullable()->unique()->after('national_id');
        });

        Schema::table('employees', function (Blueprint $table): void {
            $table->string('attendance_code', 64)->nullable()->unique()->after('phone');
        });

        DB::table('members')
            ->whereNull('attendance_code')
            ->orderBy('id')
            ->get()
            ->each(function ($member): void {
                DB::table('members')
                    ->where('id', $member->id)
                    ->update(['attendance_code' => 'M-'.Str::upper(Str::random(16))]);
            });

        DB::table('employees')
            ->whereNull('attendance_code')
            ->orderBy('id')
            ->get()
            ->each(function ($employee): void {
                DB::table('employees')
                    ->where('id', $employee->id)
                    ->update(['attendance_code' => 'E-'.Str::upper(Str::random(16))]);
            });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table): void {
            $table->dropUnique(['attendance_code']);
            $table->dropColumn('attendance_code');
        });

        Schema::table('members', function (Blueprint $table): void {
            $table->dropUnique(['attendance_code']);
            $table->dropColumn('attendance_code');
        });
    }
};
