<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_addons', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('subscription_id')->constrained('subscriptions')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $table->foreignId('coach_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status', 30)->default('active');
            $table->decimal('price_paid', 10, 2);
            $table->decimal('discount', 10, 2)->default('0.00');
            $table->unsignedInteger('sessions_total')->nullable();
            $table->unsignedInteger('sessions_remaining')->nullable();
            $table->foreignId('sold_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['member_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_addons');
    }
};
