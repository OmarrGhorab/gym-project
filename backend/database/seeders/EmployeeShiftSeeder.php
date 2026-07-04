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
     * @return array<int, array{name: string, starts_at: string, ends_at: string, grace_minutes: int, is_active: bool}>
     */
    private function shifts(): array
    {
        return [
            [
                'name' => 'Opening Shift',
                'starts_at' => '06:00',
                'ends_at' => '14:00',
                'grace_minutes' => 10,
                'is_active' => true,
            ],
            [
                'name' => 'Midday Shift',
                'starts_at' => '10:00',
                'ends_at' => '18:00',
                'grace_minutes' => 15,
                'is_active' => true,
            ],
            [
                'name' => 'Evening Shift',
                'starts_at' => '14:00',
                'ends_at' => '22:00',
                'grace_minutes' => 10,
                'is_active' => true,
            ],
            [
                'name' => 'Night Security Shift',
                'starts_at' => '22:00',
                'ends_at' => '06:00',
                'grace_minutes' => 20,
                'is_active' => true,
            ],
            [
                'name' => 'Weekend Shift',
                'starts_at' => '09:00',
                'ends_at' => '17:00',
                'grace_minutes' => 15,
                'is_active' => true,
            ],
            [
                'name' => 'Flexible Admin Shift',
                'starts_at' => '09:00',
                'ends_at' => '15:00',
                'grace_minutes' => 30,
                'is_active' => true,
            ],
        ];
    }
}
