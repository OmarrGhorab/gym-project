<?php

namespace Database\Seeders;

use App\Models\EmployeeShift;
use Illuminate\Database\Seeder;

class EmployeeShiftSeeder extends Seeder
{
    /**
     * Seed practical gym shift templates used by attendance scans.
     */
    public function run(): void
    {
        foreach ($this->shifts() as $shift) {
            EmployeeShift::query()->updateOrCreate(
                ['name' => $shift['name']],
                $shift,
            );
        }
    }

    /**
     * off_days uses Carbon dayOfWeek: 0=Sunday … 5=Friday … 6=Saturday.
     *
     * @return list<array{
     *     name: string,
     *     starts_at: string,
     *     ends_at: string,
     *     grace_minutes: int,
     *     off_days: list<int>,
     *     off_day_bonus_enabled: bool,
     *     off_day_bonus_amount: float,
     *     is_active: bool
     * }>
     */
    private function shifts(): array
    {
        return [
            [
                'name' => 'Opening Shift',
                'starts_at' => '06:00',
                'ends_at' => '14:00',
                'grace_minutes' => 10,
                'off_days' => [5], // Friday
                'off_day_bonus_enabled' => true,
                'off_day_bonus_amount' => 200.00,
                'is_active' => true,
            ],
            [
                'name' => 'Midday Shift',
                'starts_at' => '10:00',
                'ends_at' => '18:00',
                'grace_minutes' => 15,
                'off_days' => [5],
                'off_day_bonus_enabled' => true,
                'off_day_bonus_amount' => 200.00,
                'is_active' => true,
            ],
            [
                'name' => 'Evening Shift',
                'starts_at' => '14:00',
                'ends_at' => '22:00',
                'grace_minutes' => 10,
                'off_days' => [5],
                'off_day_bonus_enabled' => true,
                'off_day_bonus_amount' => 250.00,
                'is_active' => true,
            ],
            [
                'name' => 'Night Security Shift',
                'starts_at' => '22:00',
                'ends_at' => '06:00',
                'grace_minutes' => 20,
                'off_days' => [],
                'off_day_bonus_enabled' => false,
                'off_day_bonus_amount' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Weekend Shift',
                'starts_at' => '09:00',
                'ends_at' => '17:00',
                'grace_minutes' => 15,
                // Covers weekend coverage; Friday is a working day for this shift.
                'off_days' => [0, 1, 2, 3, 4], // Sun–Thu off (works Fri–Sat)
                'off_day_bonus_enabled' => false,
                'off_day_bonus_amount' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Flexible Admin Shift',
                'starts_at' => '09:00',
                'ends_at' => '15:00',
                'grace_minutes' => 30,
                'off_days' => [5],
                'off_day_bonus_enabled' => false,
                'off_day_bonus_amount' => 0.00,
                'is_active' => true,
            ],
        ];
    }
}
