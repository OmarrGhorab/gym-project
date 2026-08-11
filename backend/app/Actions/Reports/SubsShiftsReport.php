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

        // No all-time fallback when the window has no shifts: the unassigned block
        // below always accounts for the period's money, so the report is never
        // blank, and totals stay about the period the user actually picked.
        $sessions = ShiftSession::query()
            ->with(['shift:id,name', 'openedBy:id,name', 'closedBy:id,name', 'receivedBy:id,name'])
            ->when(isset($params['from']) && isset($params['to']), fn ($q) => $q->whereBetween('opened_at', [$from, $to]))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($createdBy, fn ($q) => $q->where('opened_by', $createdBy))
            ->latest('opened_at')
            ->get();

        $revenueByShift = Payment::query()
            ->revenue()
            ->whereIn('shift_session_id', $sessions->pluck('id'))
            ->selectRaw(
                'shift_session_id, SUM(CASE WHEN payable_type IN (?, ?) THEN amount ELSE 0 END) as sub_revenue, SUM(CASE WHEN payable_type = ? THEN amount ELSE 0 END) as pos_revenue',
                [Subscription::class, SubscriptionAddon::class, Sale::class]
            )
            ->groupBy('shift_session_id')
            ->get()
            ->keyBy('shift_session_id');

        $shiftsTable = $sessions->map(function (ShiftSession $session) use ($revenueByShift): array {
            $subRevenue = (float) ($revenueByShift[$session->id]->sub_revenue ?? 0);
            $posRevenue = (float) ($revenueByShift[$session->id]->pos_revenue ?? 0);

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

        // Money taken while no desk session was open still has to be accounted
        // for. Reporting only shift-attributed payments let renewals, refunds and
        // POS sales vanish from the day's totals whenever staff sold outside an
        // open shift — the balance simply never appeared anywhere.
        $unassigned = $this->unassignedRevenue($from, $to);

        return [
            'totals' => [
                'total_shifts_count' => count($shiftsTable),
                'total_subscription_revenue' => number_format($totalSubRevenue, 2, '.', ''),
                'total_pos_revenue' => number_format($totalPosRevenue, 2, '.', ''),
                'total_shift_revenue' => number_format($totalShiftRevenue, 2, '.', ''),
                'total_cash_discrepancy' => number_format($totalDiscrepancy, 2, '.', ''),
                'unassigned_subscription_revenue' => $unassigned['subscription_sales_amount'],
                'unassigned_pos_revenue' => $unassigned['pos_sales_amount'],
                'unassigned_revenue' => $unassigned['total_revenue'],
                'unassigned_payments_count' => $unassigned['payments_count'],
                // Every payment in the window, whether or not a desk was open.
                'total_period_revenue' => number_format(
                    $totalShiftRevenue + (float) $unassigned['total_revenue'],
                    2,
                    '.',
                    '',
                ),
            ],
            'shifts' => $shiftsTable,
            'unassigned' => $unassigned,
        ];
    }

    /**
     * Revenue in the window that no shift session owns.
     *
     * @return array<string, mixed>
     */
    private function unassignedRevenue(Carbon $from, Carbon $to): array
    {
        $row = Payment::query()
            ->revenue()
            ->whereNull('shift_session_id')
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw(
                'SUM(CASE WHEN payable_type IN (?, ?) THEN amount ELSE 0 END) as sub_revenue, SUM(CASE WHEN payable_type = ? THEN amount ELSE 0 END) as pos_revenue, COUNT(*) as payments_count',
                [Subscription::class, SubscriptionAddon::class, Sale::class]
            )
            ->first();

        $subRevenue = (float) ($row->sub_revenue ?? 0);
        $posRevenue = (float) ($row->pos_revenue ?? 0);

        return [
            'subscription_sales_amount' => number_format($subRevenue, 2, '.', ''),
            'pos_sales_amount' => number_format($posRevenue, 2, '.', ''),
            'total_revenue' => number_format($subRevenue + $posRevenue, 2, '.', ''),
            'payments_count' => (int) ($row->payments_count ?? 0),
        ];
    }
}
