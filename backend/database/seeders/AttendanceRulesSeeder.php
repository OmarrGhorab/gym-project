<?php

namespace Database\Seeders;

use App\Models\AttendanceViolationRule;
use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Seeds attendance violation rules and attendance settings used by:
 * - CheckInEmployeeAttendance (late, off_shift)
 * - CheckOutEmployeeAttendance (early_leave)
 * - CreateAttendanceViolation (rule matching + warning thresholds)
 * - ApplyAttendanceDeductions (payroll auto-apply)
 * - Geofence (gym radius settings)
 *
 * Rule codes must stay aligned with CreateAttendanceViolation::ruleFor():
 * - late_* codes matched by threshold_minutes for type "late"
 * - exact code match for absence, early_leave, off_shift
 */
class AttendanceRulesSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->rules() as $rule) {
            AttendanceViolationRule::query()->updateOrCreate(
                ['code' => $rule['code']],
                $rule,
            );
        }

        foreach ($this->settings() as $key => $value) {
            Setting::query()->updateOrCreate(
                ['key' => $key],
                ['value' => $value],
            );
        }
    }

    /**
     * @return list<array{
     *     code: string,
     *     name: string,
     *     description: string,
     *     threshold_minutes: int|null,
     *     warning_count_before_deduction: int,
     *     deduction_days: string,
     *     requires_admin_approval: bool,
     *     auto_apply_if_unreviewed: bool,
     *     is_active: bool
     * }>
     */
    private function rules(): array
    {
        return [
            // Late tiers — CreateAttendanceViolation picks highest late_* threshold <= minutes.
            [
                'code' => 'late_15',
                'name' => 'Late more than 15 minutes',
                'description' => 'تأخير عن 15 دقيقة بعد انتهاء فترة السماح. خصم ربع يوم بعد التحذير الأول.',
                'threshold_minutes' => 15,
                'warning_count_before_deduction' => 1,
                'deduction_days' => '0.25',
                'requires_admin_approval' => true,
                'auto_apply_if_unreviewed' => true,
                'is_active' => true,
            ],
            [
                'code' => 'late_30',
                'name' => 'Late more than 30 minutes',
                'description' => 'تأخير عن 30 دقيقة. خصم نصف يوم ويحتاج مراجعة الإدارة إن لزم.',
                'threshold_minutes' => 30,
                'warning_count_before_deduction' => 0,
                'deduction_days' => '0.50',
                'requires_admin_approval' => true,
                'auto_apply_if_unreviewed' => true,
                'is_active' => true,
            ],
            [
                'code' => 'late_60',
                'name' => 'Late more than 60 minutes',
                'description' => 'تأخير عن 60 دقيقة. خصم يوم كامل (غياب جزئي / تأخر شديد).',
                'threshold_minutes' => 60,
                'warning_count_before_deduction' => 0,
                'deduction_days' => '1.00',
                'requires_admin_approval' => true,
                'auto_apply_if_unreviewed' => true,
                'is_active' => true,
            ],

            // Full-day absence (manual/status workflows + reports; not auto from QR check-in).
            [
                'code' => 'absence',
                'name' => 'Absence without approval',
                'description' => 'غياب بدون إذن أو عذر مقبول. خصم يوم كامل من الراتب.',
                'threshold_minutes' => null,
                'warning_count_before_deduction' => 0,
                'deduction_days' => '1.00',
                'requires_admin_approval' => true,
                'auto_apply_if_unreviewed' => true,
                'is_active' => true,
            ],

            // Early checkout — CheckOutEmployeeAttendance type "early_leave".
            [
                'code' => 'early_leave',
                'name' => 'Leaving before shift end',
                'description' => 'الخروج قبل نهاية الشيفت دون إذن. خصم ربع يوم بعد تحذير واحد.',
                'threshold_minutes' => 1,
                'warning_count_before_deduction' => 1,
                'deduction_days' => '0.25',
                'requires_admin_approval' => true,
                'auto_apply_if_unreviewed' => true,
                'is_active' => true,
            ],

            // Outside assigned shift window — CheckInEmployeeAttendance type "off_shift".
            // No money deduction by default; forces pending approval / manager review.
            [
                'code' => 'off_shift',
                'name' => 'Attendance outside assigned shift',
                'description' => 'الحضور خارج نافذة الشيفت المعين. يحتاج موافقة الإدارة (بدون خصم افتراضي).',
                'threshold_minutes' => null,
                'warning_count_before_deduction' => 0,
                'deduction_days' => '0.00',
                'requires_admin_approval' => true,
                'auto_apply_if_unreviewed' => false,
                'is_active' => true,
            ],
        ];
    }

    /**
     * Attendance settings consumed by Geofence and shift grace defaults.
     *
     * @return array<string, int|float|string|null>
     */
    private function settings(): array
    {
        return [
            // Leave lat/lng null until set in Settings UI (location_status = unconfigured).
            'attendance.gym_latitude' => null,
            'attendance.gym_longitude' => null,
            'attendance.gym_radius_meters' => 150,
            'attendance.default_grace_minutes' => 15,
            // First shift open should not block on empty handover history.
            'shifts.require_handover_to_open' => false,
            'shifts.handover_auto_accept' => true,
            'shifts.handover_auto_accept_on_match_only' => true,
        ];
    }
}
