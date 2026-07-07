<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commissions', function (Blueprint $table): void {
            $table->dropUnique(['source_type', 'source_id']);

            $table->string('commission_type', 40)
                ->default('sale')
                ->after('source_id');
            $table->string('calculation_type', 20)
                ->default('percentage')
                ->after('commission_type');
            $table->decimal('rule_value', 10, 4)
                ->nullable()
                ->after('rate');
            $table->foreignId('employee_plan_commission_rule_id')
                ->nullable()
                ->after('status')
                ->constrained('employee_plan_commission_rules')
                ->nullOnDelete();

            $table->unique(['source_type', 'source_id', 'employee_id', 'commission_type'], 'commissions_source_employee_type_unique');
        });
    }

    public function down(): void
    {
        Schema::table('commissions', function (Blueprint $table): void {
            $table->dropUnique('commissions_source_employee_type_unique');
            $table->dropConstrainedForeignId('employee_plan_commission_rule_id');
            $table->dropColumn(['commission_type', 'calculation_type', 'rule_value']);
            $table->unique(['source_type', 'source_id']);
        });
    }
};
