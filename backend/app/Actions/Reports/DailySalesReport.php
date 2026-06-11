<?php

namespace App\Actions\Reports;

use App\Models\Sale;

class DailySalesReport
{
    /**
     * Generate daily sales report.
     *
     * @return array<string, mixed>
     */
    public function execute(string $date): array
    {
        $sales = Sale::query()
            ->where('sales.status', 'completed')
            ->whereDate('sales.created_at', $date)
            ->join('payments', function ($join): void {
                $join->on('payments.payable_id', '=', 'sales.id')
                    ->where('payments.payable_type', '=', Sale::class);
            })
            ->select('sales.*', 'payments.amount as paid_amount')
            ->with(['items.product', 'payment', 'member', 'soldBy'])
            ->get();

        $totalRevenue = '0.00';
        foreach ($sales as $sale) {
            $totalRevenue = bcadd($totalRevenue, (string) $sale->paid_amount, 2);
        }

        return [
            'sales' => $sales,
            'total_revenue' => $totalRevenue,
        ];
    }
}
