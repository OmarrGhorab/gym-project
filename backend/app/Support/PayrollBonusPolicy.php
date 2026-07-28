<?php

namespace App\Support;

use App\Models\Setting;

final class PayrollBonusPolicy
{
    public function cleanAttendanceEnabled(): bool
    {
        return $this->boolean('payroll.clean_attendance_bonus_enabled', true);
    }

    public function cleanAttendanceRate(): string
    {
        return $this->percentageRate('payroll.clean_attendance_bonus_percentage', '2.0000');
    }

    public function coachPerformanceEnabled(): bool
    {
        return $this->boolean('payroll.coach_performance_bonus_enabled', true);
    }

    public function coachPerformanceRate(): string
    {
        return $this->percentageRate('payroll.coach_performance_bonus_percentage', '3.0000');
    }

    private function boolean(string $key, bool $default): bool
    {
        $value = Setting::query()->where('key', $key)->value('value');

        return $value === null ? $default : filter_var($value, FILTER_VALIDATE_BOOL);
    }

    private function percentageRate(string $key, string $default): string
    {
        $value = Setting::query()->where('key', $key)->value('value');
        $percentage = $value === null ? $default : (string) $value;

        return bcdiv($percentage, '100', 6);
    }
}
