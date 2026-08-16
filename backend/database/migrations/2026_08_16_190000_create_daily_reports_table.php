<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records that a business day's report was generated and sent.
     *
     * Only the rendered PDF is kept; the figures themselves are rebuilt from the
     * ledger on every read, so a report cannot drift from the records it came
     * from. The row exists so the 05:15 job sends once and once only.
     */
    public function up(): void
    {
        Schema::create('daily_reports', function (Blueprint $table): void {
            $table->id();
            $table->date('business_date')->unique();
            $table->string('file_path')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_reports');
    }
};
