<?php

namespace Database\Seeders;

use App\Models\EmployeeShift;
use Illuminate\Database\Seeder;

class EmployeeShiftSeeder extends Seeder
{
    /**
     * Four desk shifts, each ≤ 5 hours, covering gym day 06:00–23:59.
     *
     * 1) Morning  06:00–11:00 (5h)
     * 2) Midday   11:00–16:00 (5h)
     * 3) Evening  16:00–21:00 (5h)
     * 4) Closing  21:00–23:59 (~3h to stay inside the day end)
     *
     * Plus a short Flexible Admin window for managers (not a desk shift).
     */
    public function run(): void
    {
        // Drop legacy demo shifts so only the new set remains after reseed.
        EmployeeShift::query()
            ->whereNotIn('name', collect($this->shifts())->pluck('name'))
            ->delete();

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
                'name' => 'Morning Desk 06-11',
                'starts_at' => '06:00',
                'ends_at' => '11:00',
                'grace_minutes' => 10,
                'off_days' => [5], // Friday off
                'off_day_bonus_enabled' => true,
                'off_day_bonus_amount' => 150.00,
                'is_active' => true,
            ],
            [
                'name' => 'Midday Desk 11-16',
                'starts_at' => '11:00',
                'ends_at' => '16:00',
                'grace_minutes' => 10,
                'off_days' => [5],
                'off_day_bonus_enabled' => true,
                'off_day_bonus_amount' => 150.00,
                'is_active' => true,
            ],
            [
                'name' => 'Evening Desk 16-21',
                'starts_at' => '16:00',
                'ends_at' => '21:00',
                'grace_minutes' => 10,
                'off_days' => [5],
                'off_day_bonus_enabled' => true,
                'off_day_bonus_amount' => 200.00,
                'is_active' => true,
            ],
            [
                'name' => 'Closing Desk 21-00',
                'starts_at' => '21:00',
                'ends_at' => '23:59',
                'grace_minutes' => 15,
                'off_days' => [5],
                'off_day_bonus_enabled' => true,
                'off_day_bonus_amount' => 200.00,
                'is_active' => true,
            ],
            [
                'name' => 'Flexible Admin',
                'starts_at' => '09:00',
                'ends_at' => '14:00',
                'grace_minutes' => 30,
                'off_days' => [5],
                'off_day_bonus_enabled' => false,
                'off_day_bonus_amount' => 0.00,
                'is_active' => true,
            ],
        ];
    }
}
