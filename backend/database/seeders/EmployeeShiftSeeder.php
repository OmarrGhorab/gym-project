<?php

namespace Database\Seeders;

use App\Models\EmployeeShift;
use Illuminate\Database\Seeder;

class EmployeeShiftSeeder extends Seeder
{
    /**
     * The four blocks a working day is filed under.
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
     * Shifts are only labels: which block of the day a desk session and an
     * attendance record belong to. No times, no off days.
     *
     * @return list<array{name: string, is_active: bool}>
     */
    private function shifts(): array
    {
        return [
            ['name' => 'Morning', 'is_active' => true],
            ['name' => 'Midday', 'is_active' => true],
            ['name' => 'Evening', 'is_active' => true],
            ['name' => 'Closing', 'is_active' => true],
            ['name' => 'Flexible Admin', 'is_active' => true],
        ];
    }
}
