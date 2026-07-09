<?php

use App\Models\AttendanceViolationRule;
use App\Models\Setting;
use Database\Seeders\AttendanceRulesSeeder;

test('attendance rules seeder creates all implemented gym violation rules', function (): void {
    $this->seed(AttendanceRulesSeeder::class);

    $codes = AttendanceViolationRule::query()->orderBy('code')->pluck('code')->all();

    expect($codes)->toBe([
        'absence',
        'early_leave',
        'late_15',
        'late_30',
        'late_60',
        'off_shift',
    ]);

    $late15 = AttendanceViolationRule::query()->where('code', 'late_15')->firstOrFail();
    $absence = AttendanceViolationRule::query()->where('code', 'absence')->firstOrFail();
    $offShift = AttendanceViolationRule::query()->where('code', 'off_shift')->firstOrFail();

    expect($late15->threshold_minutes)->toBe(15)
        ->and((float) $late15->deduction_days)->toBe(0.25)
        ->and($late15->warning_count_before_deduction)->toBe(1)
        ->and($late15->is_active)->toBeTrue()
        ->and((float) $absence->deduction_days)->toBe(1.0)
        ->and($absence->auto_apply_if_unreviewed)->toBeTrue()
        ->and((float) $offShift->deduction_days)->toBe(0.0)
        ->and($offShift->auto_apply_if_unreviewed)->toBeFalse();

    expect((int) Setting::query()->where('key', 'attendance.gym_radius_meters')->value('value'))->toBe(150)
        ->and((int) Setting::query()->where('key', 'attendance.default_grace_minutes')->value('value'))->toBe(15);
});

test('attendance rules seeder is idempotent', function (): void {
    $this->seed(AttendanceRulesSeeder::class);
    $this->seed(AttendanceRulesSeeder::class);

    expect(AttendanceViolationRule::query()->count())->toBe(6);
});
