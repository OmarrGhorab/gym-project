<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Retire the attendance rulebook.
 *
 * Payroll bonuses and deductions are now purely manual: every generated payroll
 * starts both at zero and an admin types in whatever the month actually earned
 * or owed. The rule tables, the automatic attendance deduction, and the
 * automatic off-day bonus all go with it.
 *
 * Paid payroll is history and is left exactly as it was banked. Pending payroll
 * is rebased onto the new model: the manual portion the admin had already added
 * survives, the automatically computed portion does not.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll', function (Blueprint $table): void {
            $table->string('manual_bonus_reason', 500)->nullable()->after('deductions');
            $table->string('manual_deduction_reason', 500)->nullable()->after('manual_bonus_reason');
        });

        $this->rebasePendingPayroll();

        Schema::table('payroll', function (Blueprint $table): void {
            $table->dropColumn(['attendance_deductions', 'attendance_snapshot']);
        });

        Schema::dropIfExists('attendance_violations');
        Schema::dropIfExists('attendance_violation_rules');

        Schema::table('attendance', function (Blueprint $table): void {
            $table->dropColumn('off_day_bonus_amount');
        });

        Schema::table('employee_shifts', function (Blueprint $table): void {
            $table->dropColumn(['off_day_bonus_enabled', 'off_day_bonus_amount']);
        });

        DB::table('settings')->whereIn('key', [
            'payroll.clean_attendance_bonus_enabled',
            'payroll.clean_attendance_bonus_percentage',
            'payroll.coach_performance_bonus_enabled',
            'payroll.coach_performance_bonus_percentage',
        ])->delete();
    }

    public function down(): void
    {
        Schema::table('employee_shifts', function (Blueprint $table): void {
            $table->boolean('off_day_bonus_enabled')->default(false)->after('off_days');
            $table->decimal('off_day_bonus_amount', 10, 2)->default(0)->after('off_day_bonus_enabled');
        });

        Schema::table('attendance', function (Blueprint $table): void {
            $table->decimal('off_day_bonus_amount', 10, 2)->default(0)->after('early_leave_minutes');
        });

        Schema::create('attendance_violation_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 80)->unique();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('threshold_minutes')->nullable();
            $table->unsignedSmallInteger('warning_count_before_deduction')->default(0);
            $table->decimal('deduction_days', 6, 2)->default(0.00);
            $table->boolean('requires_admin_approval')->default(true);
            $table->boolean('auto_apply_if_unreviewed')->default(true);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('attendance_violations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('employee_id')
                ->constrained('employees')
                ->cascadeOnDelete();
            $table->foreignId('attendance_id')
                ->nullable()
                ->constrained('attendance')
                ->nullOnDelete();
            $table->foreignId('attendance_violation_rule_id')
                ->nullable()
                ->constrained('attendance_violation_rules')
                ->nullOnDelete();
            $table->foreignId('payroll_id')
                ->nullable()
                ->constrained('payroll')
                ->nullOnDelete();
            $table->date('violation_date');
            $table->string('type', 40)->index();
            $table->unsignedInteger('minutes')->nullable();
            $table->decimal('deduction_days', 6, 2)->default(0.00);
            $table->decimal('deduction_amount', 10, 2)->default(0.00);
            $table->string('status', 30)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'violation_date']);
            $table->index(['payroll_id', 'status']);
        });

        Schema::table('payroll', function (Blueprint $table): void {
            $table->decimal('attendance_deductions', 10, 2)->default(0.00)->after('deductions');
            $table->json('attendance_snapshot')->nullable()->after('attendance_deductions');
        });

        Schema::table('payroll', function (Blueprint $table): void {
            $table->dropColumn(['manual_bonus_reason', 'manual_deduction_reason']);
        });
    }

    /**
     * Carry the admin-entered figures across, drop the computed ones, and
     * recompute net so no pending payroll is left paying an automatic bonus or
     * withholding an automatic deduction that no longer exists.
     */
    private function rebasePendingPayroll(): void
    {
        DB::table('payroll')
            ->where('status', 'pending')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $snapshot = json_decode((string) ($row->attendance_snapshot ?? ''), true);
                    $snapshot = is_array($snapshot) ? $snapshot : [];
                    $bonusSnapshot = is_array($snapshot['bonuses'] ?? null) ? $snapshot['bonuses'] : [];

                    $bonuses = array_key_exists('manual_total', $bonusSnapshot)
                        ? number_format((float) $bonusSnapshot['manual_total'], 2, '.', '')
                        : '0.00';
                    $deductions = number_format((float) $row->deductions, 2, '.', '');

                    $net = bcadd((string) $row->base_salary, (string) $row->commissions_total, 2);
                    $net = bcadd($net, $bonuses, 2);
                    $net = bcsub($net, $deductions, 2);

                    $bonusReason = trim((string) ($snapshot['manual_bonus_reason'] ?? ''));
                    $deductionReason = trim((string) ($snapshot['manual_deduction_reason'] ?? ''));

                    DB::table('payroll')->where('id', $row->id)->update([
                        'bonuses' => $bonuses,
                        'deductions' => $deductions,
                        'manual_bonus_reason' => bccomp($bonuses, '0.00', 2) === 1 && $bonusReason !== ''
                            ? $bonusReason
                            : null,
                        'manual_deduction_reason' => bccomp($deductions, '0.00', 2) === 1 && $deductionReason !== ''
                            ? $deductionReason
                            : null,
                        'net_salary' => bccomp($net, '0.00', 2) === -1 ? '0.00' : $net,
                    ]);
                }
            });
    }
};
