<?php

namespace App\Exports;

use App\Models\Payment;
use App\Models\Subscription;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PaymentsExport implements FromQuery, WithHeadings, WithMapping
{
    protected array $filters;

    public function __construct(array $filters)
    {
        $this->filters = $filters;
    }

    public function query()
    {
        $status = $this->filters['status'] ?? null;

        if ($status === 'due') {
            $paidTotals = Payment::query()
                ->selectRaw('payable_id, SUM(amount) as paid_total')
                ->where('payable_type', Subscription::class)
                ->groupBy('payable_id');

            return Subscription::query()
                ->with(['member', 'plan', 'soldBy'])
                ->leftJoinSub($paidTotals, 'paid_totals', 'paid_totals.payable_id', '=', 'subscriptions.id')
                ->select('subscriptions.*')
                ->selectRaw('COALESCE(paid_totals.paid_total, 0) as paid_total')
                ->whereRaw('subscriptions.price_paid > COALESCE(paid_totals.paid_total, 0)')
                ->orderBy('end_date');
        }

        $query = Payment::query()->with('creator');

        $customRequest = new Request(['filter' => $this->filters]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters(
                AllowedFilter::exact('status'),
            )
            ->latest();
    }

    public function headings(): array
    {
        $status = $this->filters['status'] ?? null;

        if ($status === 'due') {
            return [
                'Subscription ID',
                'Member Name',
                'Status',
                'Start Date',
                'End Date',
                'Price Paid',
                'Paid Total',
                'Balance',
            ];
        }

        return [
            'ID',
            'Amount',
            'Method',
            'Status',
            'Paid At',
            'Due Date',
            'Created By',
            'Created At',
        ];
    }

    public function map($row): array
    {
        $status = $this->filters['status'] ?? null;

        if ($status === 'due') {
            $paid = bcadd((string) ($row->paid_total ?? '0.00'), '0.00', 2);
            $balance = bcsub((string) $row->price_paid, $paid, 2);

            return [
                $row->id,
                $row->member?->name,
                $row->status,
                $row->start_date?->toDateString(),
                $row->end_date?->toDateString(),
                number_format($row->price_paid, 2, '.', ''),
                number_format($row->paid_total, 2, '.', ''),
                number_format((float) $balance, 2, '.', ''),
            ];
        }

        return [
            $row->id,
            number_format($row->amount, 2, '.', ''),
            $row->method,
            $row->status,
            $row->paid_at?->toDateTimeString(),
            $row->due_date?->toDateString(),
            $row->creator?->name ?? $row->created_by,
            $row->created_at?->toDateTimeString(),
        ];
    }
}
