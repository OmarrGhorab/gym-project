<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('member_id')
                ->constrained('members')
                ->cascadeOnDelete();
            $table->foreignId('plan_id')
                ->constrained('plans')
                ->restrictOnDelete();
            $table->date('start_date');
            $table->date('end_date')->index();
            $table->string('status', 20)->default('active')->index();
            $table->decimal('price_paid', 10, 2);
            $table->decimal('discount', 10, 2)->default('0.00');
            $table->foreignId('sold_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->date('last_reminded_on')->nullable();
            $table->timestamps();

            $table->index(['status', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
