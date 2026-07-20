<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table): void {
            $table->unsignedSmallInteger('cancellation_grace_days')
                ->default(2)
                ->after('access_grace_days');
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->unsignedSmallInteger('cancellation_grace_days')
                ->nullable()
                ->after('discount');
        });

        Schema::create('subscription_refunds', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('method', 50);
            $table->string('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();

            $table->index(['subscription_id', 'refunded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_refunds');

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->dropColumn('cancellation_grace_days');
        });

        Schema::table('plans', function (Blueprint $table): void {
            $table->dropColumn('cancellation_grace_days');
        });
    }
};
