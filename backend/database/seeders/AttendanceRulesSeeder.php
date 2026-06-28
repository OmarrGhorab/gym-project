<?php

namespace Database\Seeders;

use App\Models\AttendanceViolationRule;
use App\Models\EmployeeShift;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class AttendanceRulesSeeder extends Seeder
{
    public function run(): void
    {
        EmployeeShift::query()->firstOrCreate(
            ['name' => 'Default Morning Shift'],
            [
                'starts_at' => '09:00',
                'ends_at' => '17:00',
                'grace_minutes' => 15,
                'is_active' => true,
            ]
        );

        $rules = [
            [
                'code' => 'late_15',
                'name' => 'Late more than 15 minutes',
                'description' => 'تأخير عن 15 دقيقة',
                'threshold_minutes' => 15,
                'deduction_days' => '0.25',
            ],
            [
                'code' => 'late_30',
                'name' => 'Late more than 30 minutes',
                'description' => 'تأخير عن 30 دقيقة',
                'threshold_minutes' => 30,
                'deduction_days' => '0.50',
            ],
            [
                'code' => 'late_60',
                'name' => 'Late more than 60 minutes',
                'description' => 'تأخير عن 60 دقيقة',
                'threshold_minutes' => 60,
                'deduction_days' => '1.00',
            ],
            [
                'code' => 'absence',
                'name' => 'Absence without approval',
                'description' => 'غياب بدون إذن أو عذر مقبول',
                'threshold_minutes' => null,
                'deduction_days' => '1.00',
            ],
            [
                'code' => 'early_leave',
                'name' => 'Leaving before shift end',
                'description' => 'الخروج قبل الميعاد المحدد دون إذن',
                'threshold_minutes' => 1,
                'deduction_days' => '0.25',
            ],
            [
                'code' => 'off_shift',
                'name' => 'Attendance outside assigned shift',
                'description' => 'الحضور في شيفت مختلف يحتاج موافقة الإدارة',
                'threshold_minutes' => null,
                'deduction_days' => '0.00',
            ],
        ];

        foreach ($rules as $rule) {
            AttendanceViolationRule::query()->updateOrCreate(
                ['code' => $rule['code']],
                $rule + [
                    'requires_admin_approval' => true,
                    'auto_apply_if_unreviewed' => true,
                    'is_active' => true,
                ]
            );
        }

        $defaults = [
            'attendance.gym_latitude' => null,
            'attendance.gym_longitude' => null,
            'attendance.gym_radius_meters' => 150,
            'attendance.default_grace_minutes' => 15,
        ];

        foreach ($defaults as $key => $value) {
            Setting::query()->firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
