<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('shift_sessions')) {
            Schema::create('shift_sessions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('employee_shift_id')->constrained('employee_shifts')->cascadeOnDelete();
                $table->date('business_date');
                $table->timestamp('opened_at');
                $table->timestamp('closed_at')->nullable();
                $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 30)->default('open');
                $table->decimal('opening_float', 12, 2)->default(0);
                $table->decimal('expected_cash', 12, 2)->nullable();
                $table->decimal('expected_card', 12, 2)->nullable();
                $table->decimal('expected_bank', 12, 2)->nullable();
                $table->decimal('expected_expenses', 12, 2)->nullable();
                $table->decimal('expected_net', 12, 2)->nullable();
                $table->decimal('counted_cash', 12, 2)->nullable();
                $table->decimal('counted_card', 12, 2)->nullable();
                $table->decimal('counted_bank', 12, 2)->nullable();
                $table->decimal('counted_expenses', 12, 2)->nullable();
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('variance_notes')->nullable();
                $table->foreignId('admin_reviewed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('admin_reviewed_at')->nullable();
                $table->string('admin_decision', 20)->nullable();
                $table->foreignId('previous_session_id')->nullable()->constrained('shift_sessions')->nullOnDelete();
                $table->timestamps();

                $table->index(['status', 'business_date']);
                $table->index(['employee_shift_id', 'business_date']);
            });
        }

        if (! Schema::hasColumn('payments', 'shift_session_id')) {
            Schema::table('payments', function (Blueprint $table): void {
                $table->foreignId('shift_session_id')
                    ->nullable()
                    ->after('created_by')
                    ->constrained('shift_sessions')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('expenses', 'shift_session_id')) {
            Schema::table('expenses', function (Blueprint $table): void {
                $table->foreignId('shift_session_id')
                    ->nullable()
                    ->after('created_by')
                    ->constrained('shift_sessions')
                    ->nullOnDelete();
            });
        }

        // sales uses sold_by_user_id, not created_by
        if (Schema::hasTable('sales') && ! Schema::hasColumn('sales', 'shift_session_id')) {
            Schema::table('sales', function (Blueprint $table): void {
                $table->foreignId('shift_session_id')
                    ->nullable()
                    ->after('sold_by_user_id')
                    ->constrained('shift_sessions')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('sales') && Schema::hasColumn('sales', 'shift_session_id')) {
            Schema::table('sales', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('shift_session_id');
            });
        }

        if (Schema::hasColumn('expenses', 'shift_session_id')) {
            Schema::table('expenses', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('shift_session_id');
            });
        }

        if (Schema::hasColumn('payments', 'shift_session_id')) {
            Schema::table('payments', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('shift_session_id');
            });
        }

        Schema::dropIfExists('shift_sessions');
    }
};
