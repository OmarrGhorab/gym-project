<?php

namespace App\Actions\MemberVisits;

use App\Models\MemberVisit;
use Illuminate\Support\Carbon;

final class AutoCloseStaleMemberVisits
{
    public const MAX_VISIT_HOURS = 3;

    public const SYSTEM_NOTE = 'System auto checkout: member visit was automatically closed after 3 hours without checkout.';

    public function handle(?Carbon $now = null): int
    {
        $now ??= now();
        $cutoff = $now->copy()->subHours(self::MAX_VISIT_HOURS);
        $closed = 0;

        MemberVisit::query()
            ->whereNull('check_out_at')
            ->where('check_in_at', '<=', $cutoff)
            ->orderBy('id')
            ->chunkById(100, function ($visits) use (&$closed): void {
                foreach ($visits as $visit) {
                    $visit->update([
                        'check_out_at' => $visit->check_in_at?->copy()->addHours(self::MAX_VISIT_HOURS),
                        'notes' => $this->appendSystemNote($visit->notes),
                    ]);

                    $closed++;
                }
            });

        return $closed;
    }

    private function appendSystemNote(?string $notes): string
    {
        $notes = trim((string) $notes);

        if ($notes === '') {
            return self::SYSTEM_NOTE;
        }

        if (str_contains($notes, self::SYSTEM_NOTE)) {
            return $notes;
        }

        return $notes.PHP_EOL.self::SYSTEM_NOTE;
    }
}
