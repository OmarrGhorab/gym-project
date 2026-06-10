<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Creates the foundation settings key/value table.
// The unique index on `key` enforces one record per setting name and is
// required because StoreSetting uses updateOrCreate keyed on this column.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table): void {
            $table->id();
            // The setting key, e.g. "gym.name", "gym.currency". Must be unique.
            $table->string('key')->unique();
            // Stored as JSON so scalar, array, and object values are all supported.
            $table->json('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
