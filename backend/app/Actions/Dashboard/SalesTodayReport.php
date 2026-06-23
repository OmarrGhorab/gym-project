<?php

namespace App\Actions\Dashboard;

use Illuminate\Support\Facades\DB;

final class SalesTodayReport
{
    /** @return array{count: int, revenue: string} */
    public function execute(): array
    {
        $result = DB::table('sales')
            ->whereDate('created_at', now()->toDateString())
            ->where('status', 'completed')
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(total), 0) as revenue')
            ->first();

        return [
            'count' => (int) $result->count,
            'revenue' => number_format((float) $result->revenue, 2, '.', ''),
        ];
    }
}
