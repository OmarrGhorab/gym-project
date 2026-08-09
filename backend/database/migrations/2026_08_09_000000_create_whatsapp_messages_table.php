<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_messages', function (Blueprint $table) {
            $table->id();
            // Both nullable + nullOnDelete: the send log outlives the member or
            // subscription it was about, so "did we message this person?" still
            // has an answer after a deletion.
            $table->foreignId('member_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->string('template_key', 64);
            $table->string('phone', 32);
            $table->text('body');
            $table->string('image_url', 512)->nullable();
            $table->string('status', 16)->default('pending');
            $table->string('provider_message_id', 128)->nullable();
            $table->text('error')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            // Backs the dedup lookup in SendMemberMessage, which is what stops a
            // member being messaged again every time a trigger re-fires.
            $table->index(['subscription_id', 'template_key', 'status'], 'whatsapp_messages_dedup_index');
            $table->index(['member_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_messages');
    }
};
