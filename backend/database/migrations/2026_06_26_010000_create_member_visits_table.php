<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_visits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')
                ->constrained('members')
                ->cascadeOnDelete();
            $table->foreignId('subscription_id')
                ->nullable()
                ->constrained('subscriptions')
                ->nullOnDelete();
            $table->dateTime('check_in_at');
            $table->dateTime('check_out_at')->nullable();
            $table->string('status', 20)->default('allowed')->index();
            $table->string('alert_reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();

            $table->index(['member_id', 'check_in_at']);
            $table->index(['subscription_id', 'check_in_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_visits');
    }
};
