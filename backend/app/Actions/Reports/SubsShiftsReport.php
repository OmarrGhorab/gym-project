<?php

namespace App\Actions\Reports;

use App\Models\Payment;
use App\Models\Sale;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\Carbon;

final class SubsShiftsReport
{
    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $from = Carbon::parse($params['from'] ?? now()->startOfMonth()->toDateString())->startOfDay();
        $to = Carbon::parse($params['to'] ?? now()->toDateString())->endOfDay();
        $status = $params['status'] ?? null;
        $createdBy = isset($params['created_by']) && $params['created_by'] !== '' ? (int) $params['created_by'] : null;

        $sessionsQuery = ShiftSession::query()
            ->with(['shift:id,name', 'openedBy:id,name', 'closedBy:id,name', 'receivedBy:id,name'])
            ->when(isset($params['from']) && isset($params['to']), fn ($q) => $q->whereBetween('opened_at', [$from, $to]))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($createdBy, fn ($q) => $q->where('opened_by', $createdBy))
            ->latest('opened_at');

        if ($sessionsQuery->count() === 0 && ! $status && ! $createdBy) {
            $sessionsQuery = ShiftSession::query()
                ->with(['shift:id,name', 'openedBy:id,name', 'closedBy:id,name', 'receivedBy:id,name'])
                ->latest('opened_at');
        }

        $sessions = $sessionsQuery->get();

        $shiftsTable = $sessions->map(function (ShiftSession $session): array {
            $subRevenue = (float) Payment::query()
                ->revenue()
                ->where('shift_session_id', $session->id)
                ->whereIn('payable_type', [Subscription::class, SubscriptionAddon::class])
                ->sum('amount');

            $posRevenue = (float) Payment::query()
                ->revenue()
                ->where('shift_session_id', $session->id)
                ->where('payable_type', Sale::class)
                ->sum('amount');

            $totalShiftRevenue = $subRevenue + $posRevenue;
            $cashDiscrepancy = $session->counted_cash !== null && $session->expected_cash !== null
                ? (float) bcsub((string) $session->counted_cash, (string) $session->expected_cash, 2)
                : 0.0;

            return [
                'id' => $session->id,
                'shift_name' => $session->shift?->name ?? 'Standard Shift',
                'opened_by' => $session->openedBy?->name ?? 'Unknown',
                'closed_by' => $session->closedBy?->name ?? 'Not Closed Yet',
                'received_by' => $session->receivedBy?->name,
                'opened_at' => $session->opened_at?->toIso8601String(),
                'closed_at' => $session->closed_at?->toIso8601String(),
                'status' => $session->status,
                'subscription_sales_amount' => number_format($subRevenue, 2, '.', ''),
                'pos_sales_amount' => number_format($posRevenue, 2, '.', ''),
                'total_revenue' => number_format($totalShiftRevenue, 2, '.', ''),
                'opening_cash' => number_format((float) $session->opening_cash, 2, '.', ''),
                'expected_cash' => number_format((float) ($session->expected_cash ?? 0), 2, '.', ''),
                'counted_cash' => $session->counted_cash !== null ? number_format((float) $session->counted_cash, 2, '.', '') : null,
                'discrepancy' => number_format($cashDiscrepancy, 2, '.', ''),
            ];
        })->values()->all();

        $totalSubRevenue = array_sum(array_column($shiftsTable, 'subscription_sales_amount'));
        $totalPosRevenue = array_sum(array_column($shiftsTable, 'pos_sales_amount'));
        $totalShiftRevenue = $totalSubRevenue + $totalPosRevenue;
        $totalDiscrepancy = array_sum(array_column($shiftsTable, 'discrepancy'));

        return [
            'totals' => [
                'total_shifts_count' => count($shiftsTable),
                'total_subscription_revenue' => number_format($totalSubRevenue, 2, '.', ''),
                'total_pos_revenue' => number_format($totalPosRevenue, 2, '.', ''),
                'total_shift_revenue' => number_format($totalShiftRevenue, 2, '.', ''),
                'total_cash_discrepancy' => number_format($totalDiscrepancy, 2, '.', ''),
            ],
            'shifts' => $shiftsTable,
        ];
    }
}
